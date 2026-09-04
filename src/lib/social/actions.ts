"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/auth";
import { getCurrentUid } from "@/lib/auth/sesion";
import { adminDb, borrarDelBucket } from "@/lib/firebase/admin";
import { COL, SUB } from "@/lib/firebase/collections";
import type { CommentDoc, GalleryDoc, PostDoc, UserDoc } from "@/lib/firebase/schema";
import { getDirectorio } from "@/lib/social/directorio";
import { saneaFicha, type FichaInput } from "@/lib/social/ficha";
import { notifyAll, notifyUser } from "@/lib/social/notify";
import type { GalleryItem, PostMediaItem } from "@/lib/social/types";

/** Escrituras del dominio, como Server Actions.
 *
 *  Es la mitad "write" del par con `queries.ts`. Las pantallas cliente reciben
 *  estas funciones como props y las llaman igual que a un fetch: no conocen el
 *  store.
 *
 *  **Quién escribe sale de la cookie de sesión**, no de un parámetro. Antes era
 *  `db.currentUserId`, una constante: cualquiera que llamara una de estas
 *  acciones escribía como la misma cuenta. Ahora cada una arranca pidiendo el
 *  uid, y sin sesión no hace nada — que no es redundante con esconder el botón
 *  en la UI: una Server Action es un endpoint POST que se puede invocar sin
 *  pasar por ninguna pantalla.
 *
 *  Se sale en silencio en vez de tirar un error, igual que cuando el post no
 *  existe: las pantallas ya gatean por sesión, así que llegar acá sin ella es
 *  una llamada que nadie hizo desde la app y no hay a quién avisarle.
 *
 *  Todas revalidan las rutas afectadas, incluidas las del admin: el panel no
 *  tiene datos propios, mira exactamente lo mismo que el feed.
 */

/** Nombre para el texto de una notificación; "Alguien" si la cuenta ya no está. */
const nombreDe = async (uid: string) => (await getDirectorio()).byId(uid)?.name ?? "Alguien";

/** El handle de una cuenta, para revalidar su perfil público. */
const handleDe = async (uid: string) => (await getDirectorio()).byId(uid)?.handle;

/** Primer renglón de un texto para la bajada de una notificación: una línea,
 *  sin cortar a mitad de palabra y con puntos suspensivos si sobra. */
const recorte = (s: string, max = 90) => {
  const linea = s.trim().split("\n")[0];
  if (linea.length <= max) return linea;
  return linea.slice(0, linea.lastIndexOf(" ", max) > 0 ? linea.lastIndexOf(" ", max) : max) + "…";
};

const revalidatePublic = (postId?: string) => {
  revalidatePath("/");
  // El foro lee el mismo `getFeed()` que el feed: sin esto, un post publicado
  // desde el FAB no aparece hasta recargar.
  revalidatePath("/foro");
  if (postId) revalidatePath(`/post/${postId}`);
  revalidatePath("/perfil");
};

/* ── publicaciones ───────────────────────────────────────────────────────── */

/** Publica en el feed. `media` son las imagenes YA comprimidas y subidas a
 *  Firebase Storage por el compositor (`lib/storage/post-image.ts`): cada item
 *  trae la `downloadURL` en `src` y su ruta en el bucket en `path`. Por aci no
 *  viaja ningun archivo.
 *
 *  Un post puede ser solo texto o solo imagenes: lo unico que se rechaza es
 *  que no venga ninguna de las dos. */
export async function publishPost(
  text: string,
  media: PostMediaItem[] = [],
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim();
  // `slice(0, 4)`: `SocialPost` muestra cuatro y colapsa el resto en un "+N",
  // asi que mas de cuatro es peso que nadie ve.
  const fotos = media.filter((m) => m.src).slice(0, 4);
  if (!clean && fotos.length === 0) return;

  const db2 = adminDb();
  const ref = db2.collection(COL.post).doc();

  /*  El alta y el contador del autor, juntos. Si el contador se moviera aparte,
   *  un error entre las dos escrituras dejaria un perfil diciendo "12
   *  publicaciones" con once. */
  const batch = db2.batch();
  batch.set(ref, {
    authorId: uid,
    text: clean,
    media: fotos,
    createdAt: FieldValue.serverTimestamp(),
    likedBy: [],
    shares: 0,
    // Explicito y no omitido: el feed consulta `where("hidden", "==", false)` y
    // una query de igualdad no devuelve los documentos sin el campo.
    hidden: false,
    commentCount: 0,
  });
  batch.update(db2.collection(COL.user).doc(uid), {
    "stats.posts": FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  const id = ref.id;

  // Aviso de campanita al resto de la comunidad: alguien publicó en el feed.
  // `notifyAll` ya excluye al autor.
  await notifyAll({
    kind: "post",
    actorId: uid,
    text: `${await nombreDe(uid)} publicó en el feed`,
    description: clean ? recorte(clean) : "Compartió fotos",
    href: `/post/${id}`,
  });

  revalidatePublic();
  revalidatePath("/notificaciones");
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const ref = adminDb().collection(COL.post).doc(postId);
  const snap = await ref.get();
  const post = snap.data() as PostDoc | undefined;
  if (!post) return;

  const yaEstaba = !!post.likedBy?.includes(uid);

  /*  `arrayUnion`/`arrayRemove` y no escribir el array entero: dos personas
   *  dando like a la vez con la lista completa se pisan y uno de los dos likes
   *  desaparece. Estas dos operaciones las resuelve el servidor de Firestore
   *  sobre el valor actual, sin importar con qué copia llegó cada uno. */
  await ref.update({
    likedBy: liked ? FieldValue.arrayUnion(uid) : FieldValue.arrayRemove(uid),
  });

  // Un aviso al autor por cada like NUEVO —quitar y volver a poner el like
  // vuelve a avisar, sacarlo no—. `notifyUser` ya descarta el like a uno mismo.
  if (liked && !yaEstaba) {
    await notifyUser(post.authorId, {
      kind: "like",
      actorId: uid,
      text: `A ${await nombreDe(uid)} le gustó tu publicación`,
      description: recorte(post.text) || "Tu publicación",
      href: `/post/${postId}`,
    });
    revalidatePath("/notificaciones");
  }

  revalidatePublic(postId);
}

/** Guarda o desguarda una publicación.
 *
 *  Escribe en `trapnexport-user/{uid}/saved/{postId}`, no en la publicación: es
 *  privado, no tiene contador visible, y si viviera en el post cada "guardar"
 *  reescribiría el documento que todo el feed está leyendo. El id del documento
 *  es el de la publicación, así que guardar dos veces es idempotente. */
export async function toggleSave(postId: string, saved: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const ref = adminDb().collection(COL.user).doc(uid).collection(SUB.saved).doc(postId);

  if (saved) await ref.set({ createdAt: FieldValue.serverTimestamp() });
  else await ref.delete().catch(() => {});

  revalidatePublic(postId);
}

export async function registerShare(postId: string): Promise<void> {
  // Sin sesión: compartir un link es algo que puede hacer cualquiera que vea la
  // publicación, y el contador cuenta veces compartida, no personas.
  await adminDb()
    .collection(COL.post)
    .doc(postId)
    .update({ shares: FieldValue.increment(1) })
    .catch(() => {});

  revalidatePublic(postId);
}

/* ── perfil propio ──────────────────────────────────────────────────── */

/** Cambia la foto de perfil.
 *
 *  `src` es la `downloadURL` de Firebase Storage (subida propia, ya reescalada
 *  a 512px por `lib/media-upload.ts`) o uno de los avatares generados por
 *  `avatarUrl`, que son data-URIs de un SVG chico. `path` sólo viene con el
 *  primer caso: es la ruta en el bucket, y hace falta para poder borrar el
 *  archivo anterior.
 *
 *  Escribe en `trapnexport-user/{uid}` con el Admin SDK. Las reglas dejarian que
 *  lo hiciera el navegador (`avatar` esta en `editableByOwner`), pero el uid de
 *  la cookie es una fuente mas confiable que un campo del formulario, y asi la
 *  pantalla no tiene que saber de Firestore.
 *
 *  **Devuelve el resultado en vez de salir en silencio.** Es la excepción a la
 *  regla del archivo, y por una razón concreta: acá no hay ninguna otra señal.
 *  Un like que no se guarda se nota porque el corazón vuelve; una foto de perfil
 *  que no se guarda se ve puesta hasta que alguien recarga la pantalla, y el
 *  `catch` vacío que había antes se tragaba justo el caso que hay que contar
 *  —la cuenta sin documento, la sesión vencida—. `AvatarPicker` muestra el
 *  mensaje.
 *
 *  Revalida `/u/[handle]` ademas del feed: el avatar viejo quedaria cacheado en
 *  el perfil publico de la misma persona.
 */
export async function updateAvatar(
  src: string,
  path?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uid = await getCurrentUid();
  if (!uid) return { ok: false, error: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
  if (!src) return { ok: false, error: "No se pudo leer la foto elegida." };

  const ref = adminDb().collection(COL.user).doc(uid);
  const snap = await ref.get();
  const anterior = (snap.data() as UserDoc | undefined)?.avatarPath;

  try {
    await ref.update({
      avatar: src,
      // `deleteField()` y no `undefined`: cambiar de una foto subida a un avatar
      // generado tiene que **borrar** la ruta vieja, o el próximo cambio
      // intentaría borrar un archivo que ya no le corresponde a este usuario.
      avatarPath: path ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la foto. Probá de nuevo." };
  }

  /*  La foto anterior se borra del bucket. Sin esto cada cambio de avatar deja
   *  un archivo que nadie referencia y que no se puede encontrar después: el
   *  nombre es al azar y la única pista era el `avatarPath` que se acaba de
   *  pisar. Va después de la escritura: si se borrara antes y la escritura
   *  fallara, la cuenta quedaría apuntando a un archivo inexistente. */
  if (anterior && anterior !== path) await borrarDelBucket(anterior);

  const handle = await handleDe(uid);

  revalidatePublic();
  if (handle) revalidatePath(`/u/${handle}`);
  revalidatePath("/admin/usuarios");

  return { ok: true };
}

/** Reemplaza la ficha deportiva entera: datos personales y skills.
 *
 *  Entera y no campo por campo: el panel es un formulario con Guardar, no
 *  autoguardado por input. Un campo vacio se borra (queda `undefined`), que es
 *  justo lo que espera quien limpia el input y guarda.
 *
 *  Lo que se guarde acá es lo que `/historia` muestra en la ficha del jugador:
 *  las skills y los datos personales de esa pantalla salen de la cuenta
 *  vinculada antes que de la ficha institucional del club. Por eso la misma
 *  ficha la puede escribir el panel (`guardarFichaDeCuenta`) cuando la persona
 *  no la completó, y por eso las dos comparten `saneaFicha`.
 */
export async function updateFicha(
  input: FichaInput & { bio?: string | null },
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  /*  El saneo vive en `lib/social/ficha.ts` y no acá porque el panel de admin
   *  escribe esta misma ficha por quien no la completó
   *  (`guardarFichaDeCuenta`): dos validadores sobre la misma clave se
   *  desincronizan en cuanto se agrega un campo. */
  const cambios: Record<string, unknown> = {
    ficha: saneaFicha(input),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // La bio no es parte de la ficha (es dato de la red social, no del jugador)
  // pero se edita en el mismo panel: es un solo Guardar para el usuario.
  if (input.bio !== undefined) {
    const bio = input.bio?.trim().slice(0, 160);
    cambios.bio = bio || FieldValue.delete();
  }

  await adminDb().collection(COL.user).doc(uid).update(cambios).catch(() => {});

  const handle = await handleDe(uid);

  revalidatePublic();
  if (handle) revalidatePath(`/u/${handle}`);
  // La historia del club muestra esta ficha en la trayectoria de quien la
  // cargó: sin esto, cambiar el puesto no se ve en `/historia` hasta el
  // próximo deploy.
  revalidatePath("/historia");
}

/** Suma una foto o un video al carrete personal.
 *
 *  No publica nada en el feed: el carrete es material propio del perfil. Para
 *  que salga al feed hay que pasarlo por el compositor (`publishPost`).
 */
export async function addGalleryItem(input: {
  kind: GalleryItem["kind"];
  src: string;
  /** ruta en el bucket, para poder borrar el archivo con el documento */
  path?: string;
  alt?: string;
}): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid || !input.src) return;
  if (input.kind !== "image" && input.kind !== "video") return;

  const db2 = adminDb();
  const userRef = db2.collection(COL.user).doc(uid);

  const batch = db2.batch();
  batch.set(userRef.collection(SUB.gallery).doc(), {
    kind: input.kind,
    src: input.src,
    path: input.path ?? "",
    alt: input.alt?.trim().slice(0, 80) || (input.kind === "video" ? "Video" : "Foto"),
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(userRef, { "stats.gallery": FieldValue.increment(1) });
  await batch.commit();

  const handle = await handleDe(uid);

  revalidatePath("/perfil");
  if (handle) revalidatePath(`/u/${handle}`);
}

export async function removeGalleryItem(id: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const userRef = db2.collection(COL.user).doc(uid);
  const ref = userRef.collection(SUB.gallery).doc(id);

  const snap = await ref.get();
  const item = snap.data() as GalleryDoc | undefined;
  // La ruta es la única forma de encontrar el archivo: el nombre es al azar.
  // Hay que leerla ANTES de borrar el documento.
  if (!item) return;

  const batch = db2.batch();
  batch.delete(ref);
  batch.update(userRef, { "stats.gallery": FieldValue.increment(-1) });
  await batch.commit();

  if (item.path) await borrarDelBucket(item.path);

  const handle = await handleDe(uid);

  revalidatePath("/perfil");
  if (handle) revalidatePath(`/u/${handle}`);
}

/* ── comentarios ─────────────────────────────────────────────────────────── */

export async function addComment(
  postId: string,
  text: string,
  parentId?: string | null,
): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const clean = text.trim();
  if (!clean) return;

  const db2 = adminDb();
  const postRef = db2.collection(COL.post).doc(postId);
  const snap = await postRef.get();
  const post = snap.data() as PostDoc | undefined;
  // Comentar una publicación que ya no está dejaría un comentario huérfano que
  // ninguna pantalla muestra.
  if (!post) return;

  /*  Comentario, contador de la publicación y contador del autor, en un lote.
   *  `commentCount` está desnormalizado para que el feed no tenga que contar
   *  comentarios por publicación; si se moviera aparte del alta, el número
   *  dejaría de coincidir con la lista apenas fallara una de las dos. */
  const batch = db2.batch();
  batch.set(db2.collection(COL.comment).doc(), {
    postId,
    authorId: uid,
    text: clean,
    createdAt: FieldValue.serverTimestamp(),
    likedBy: [],
    parentId: parentId ?? null,
  });
  batch.update(postRef, { commentCount: FieldValue.increment(1) });
  batch.update(db2.collection(COL.user).doc(uid), {
    "stats.comments": FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  // Aviso al autor del post por cada comentario (una respuesta también lo es).
  // `notifyUser` descarta comentar el propio post.
  await notifyUser(post.authorId, {
    kind: "comment",
    actorId: uid,
    text: `${await nombreDe(uid)} comentó tu publicación`,
    description: recorte(clean),
    href: `/post/${postId}`,
  });
  revalidatePath("/notificaciones");

  revalidatePublic(postId);
  revalidatePath("/admin");
}

export async function toggleCommentLike(commentId: string, liked: boolean): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const ref = adminDb().collection(COL.comment).doc(commentId);
  const snap = await ref.get();
  const comment = snap.data() as CommentDoc | undefined;
  if (!comment) return;

  await ref.update({
    likedBy: liked ? FieldValue.arrayUnion(uid) : FieldValue.arrayRemove(uid),
  });

  revalidatePublic(comment.postId);
}

/** Borra un comentario propio.
 *
 *  El corte por autor es nuevo, y hace falta desde que la identidad es real:
 *  mientras todos escribían como la misma cuenta semilla, "es mío" era cierto
 *  para cualquier comentario y la comprobación no hubiera hecho nada. Ahora sin
 *  esto cualquiera borra el comentario de cualquiera con un POST.
 *
 *  La moderación del panel no pasa por acá: `/admin/publicaciones` borra
 *  publicaciones enteras con `deletePost`, detrás de `requireAdmin()`.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const ref = db2.collection(COL.comment).doc(commentId);
  const snap = await ref.get();
  const comment = snap.data() as CommentDoc | undefined;
  if (!comment) return;
  if (comment.authorId !== uid) return;

  // Las respuestas de un comentario borrado quedarían huérfanas: ninguna
  // pantalla las dibuja, porque `CommentBox` las cuelga de su padre.
  const respuestas = await db2
    .collection(COL.comment)
    .where("parentId", "==", commentId)
    .get();

  const borrados = 1 + respuestas.size;

  const batch = db2.batch();
  batch.delete(ref);
  respuestas.docs.forEach((d) => batch.delete(d.ref));
  batch.update(db2.collection(COL.post).doc(comment.postId), {
    commentCount: FieldValue.increment(-borrados),
  });
  /*  El contador del autor baja sólo por el comentario propio. Las respuestas
   *  borradas de arrastre son de otras cuentas y no se descuentan de las suyas:
   *  hacerlo bien serían N lecturas para saber de quién es cada una, y el
   *  número que queda mal es una estadística del perfil, no un permiso. */
  batch.update(db2.collection(COL.user).doc(uid), {
    "stats.comments": FieldValue.increment(-1),
  });
  await batch.commit();

  revalidatePublic(comment.postId);
  revalidatePath("/admin");
}

/*  Las escrituras del chat se fueron a `lib/chat/actions.ts`. */

/* ── notificaciones ──────────────────────────────────────────────────────── */

/*  Las tres operan sobre `trapnexport-notification` con el Admin SDK. El
 *  `.catch()` traga el caso de una fila que otra pestaña ya borró: marcar como
 *  leída algo que no está no es un error que el usuario tenga que ver. */

export async function markNotificationRead(id: string): Promise<void> {
  await adminDb()
    .collection(COL.notificacion)
    .doc(id)
    .update({ read: true })
    .catch(() => {});
  revalidatePath("/notificaciones");
}

export async function markAllNotificationsRead(): Promise<void> {
  const uid = await getCurrentUid();
  if (!uid) return;

  const db2 = adminDb();
  const snap = await db2
    .collection(COL.notificacion)
    .where("userId", "==", uid)
    .where("read", "==", false)
    .get();

  if (snap.size) {
    const batch = db2.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
  revalidatePath("/notificaciones");
}

export async function dismissNotification(id: string): Promise<void> {
  await adminDb()
    .collection(COL.notificacion)
    .doc(id)
    .delete()
    .catch(() => {});
  revalidatePath("/notificaciones");
}

/* ── cuentas (registro) ──────────────────────────────────────────────────── */

/*  El alta ya NO pasa por acá. Vive en `lib/auth/register.ts` y escribe en
 *  Firestore desde el navegador: la transacción que reserva el handle tiene que
 *  ir firmada con el token del usuario para que `firestore.rules` la pueda
 *  validar, y una server action recibiría el uid como un campo más del
 *  formulario. Lo que queda en este store son las cuentas semilla del feed.
 */

/* ── moderación (sólo /admin) ────────────────────────────────────────────── */

export async function setPostHidden(postId: string, hidden: boolean): Promise<void> {
  await requireAdmin();

  await adminDb().collection(COL.post).doc(postId).update({ hidden }).catch(() => {});

  revalidatePublic(postId);
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

/** Borra una publicación, sus comentarios y sus imágenes.
 *
 *  Las imágenes son lo nuevo: `PostMediaDoc.path` existía desde que el
 *  compositor sube a Storage y no lo usaba nadie, así que cada publicación
 *  borrada dejaba sus fotos en el bucket para siempre. Se borran con el Admin
 *  SDK y no desde el navegador porque quien aprieta el botón es el panel, que no
 *  es el dueño de los archivos.
 *
 *  El orden importa: primero los documentos, después los archivos. Al revés, un
 *  fallo en el medio dejaría una publicación viva apuntando a fotos que ya no
 *  existen — un post roto es peor que un archivo huérfano.
 */
export async function deletePost(postId: string): Promise<void> {
  await requireAdmin();

  const db2 = adminDb();
  const postRef = db2.collection(COL.post).doc(postId);

  const [snap, comentarios] = await Promise.all([
    postRef.get(),
    db2.collection(COL.comment).where("postId", "==", postId).get(),
  ]);

  const post = snap.data() as PostDoc | undefined;
  if (!post) return;

  const batch = db2.batch();
  batch.delete(postRef);
  comentarios.docs.forEach((d) => batch.delete(d.ref));
  batch.update(db2.collection(COL.user).doc(post.authorId), {
    "stats.posts": FieldValue.increment(-1),
  });
  await batch.commit();

  await Promise.all(
    (post.media ?? []).map((m) => (m.path ? borrarDelBucket(m.path) : Promise.resolve())),
  );

  revalidatePublic();
  revalidatePath("/admin");
  revalidatePath("/admin/publicaciones");
}

/*  Suspender cuentas y revisar reclamos ya no vive acá: esas operaciones son
 *  sobre cuentas reales de Firestore y las hace `lib/admin/acciones.ts` con el
 *  Admin SDK. Este store sólo tiene el contenido semilla del feed. */
