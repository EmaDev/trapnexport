# Plan de migración

Este documento reemplaza a la sección *Qué falta* del [README](README.md), que
quedó vieja: de sus cinco puntos, tres ya están hechos y el que falta está mal
descripto. Acá está lo que queda, en el orden en que se puede hacer y con el
porqué de cada decisión.

## El estado real

Lo que el README todavía lista como pendiente y **ya está**:

| Punto del README | Dónde está hoy |
|---|---|
| Auth real (Firebase) en `/` y `/admin` | `lib/auth/*`, `lib/admin/auth.ts` — el `TODO(firebase)` no existe más; el flag `ADMIN_AUTH_ENABLED` se eliminó a propósito |
| Persistencia (Firestore) | El contenido del panel (noticias, encuestas, invitaciones, eventos, config) y las notificaciones ya son documentos |
| Subida de imágenes | `lib/storage/post-image.ts` sube al bucket y manda sólo la `downloadURL` |

Lo que queda es, en una línea: **el módulo social sigue en el store en memoria y
sobre una identidad falsa**.

## La decisión de fondo: una sola identidad

Hoy hay dos modelos de usuario en paralelo, y no se hablan:

```
trapnexport-user/{uid}          ← Firestore. id = uid de Firebase Auth.
  ↑ lo escribe el navegador al registrarse (firestore.rules es LA validación)
  ↑ lo lee lib/auth/profile.ts con onSnapshot → AccountVM (cliente)

db.users  (lib/social/store.ts) ← memoria. id = slug del jugador ("naza-sochan").
  ↑ derivado de JUGADORES (lib/trap-awards.ts)
  ↑ lo lee lib/social/queries.ts → SessionVM / ProfileVM (servidor)
```

Y en el medio, [`store.ts:33`](src/lib/social/store.ts#L33):

```ts
/** La cuenta desde la que se ve la app mientras no haya login. */
const YO = "emanuel-cisterna";
```

**El feed muestra siempre la misma cuenta, inicie sesión quien inicie.** No es
un bug suelto: `db.currentUserId` aparece 12 veces entre `queries.ts`,
`actions.ts` y `PerfilClient.tsx`, y es lo que decide qué post está likeado, de
quién es el perfil, qué notificaciones se leen y quién manda cada mensaje. El
propio [`session.ts`](src/lib/session.ts#L15) lo dice: *"esto sólo destapa el
splash, no cambia de quién se ve el feed. Ese es el próximo paso, no este"*.

Por eso el orden del plan no es negociable: **primero la sesión, después la
identidad, después los datos**. Migrar `posts` a Firestore antes de tener el uid
significaría escribir `authorId: "naza-sochan"` en documentos reales y después
tener que reescribirlos todos.

## Dos decisiones tomadas

### 1. La sesión del servidor va por cookie, no por idToken

El fix que está en el working tree pasa el `idToken` como parámetro a
`votarEncuesta`. Sirve para una action suelta, pero no escala a las 17 de
`social/actions.ts`, y sobre todo **no le sirve a los Server Components**:
`getFeed`, `getMyProfile`, `getNotifications` y `getUnreadChats` corren en el
servidor antes de que exista ningún cliente al que pedirle un token. Con
idToken habría que reescribir esas cuatro pantallas a cliente con `onSnapshot`.

Con cookie, las 13 queries y las 17 actions **mantienen sus firmas**: sólo
cambia de dónde sale el uid. Que es exactamente lo que `queries.ts` prometió en
su encabezado — *"Cuando `store.ts` pase a Firestore, sólo cambia el cuerpo de
estas funciones"*.

**Una sola cookie para los dos módulos, y no por comodidad.** Firebase Hosting
descarta cualquier cookie que no se llame `__session` en respuestas cacheables,
así que no se puede tener `__session_admin` aparte. La separación entre público
y panel no la hace el nombre de la cookie: la hace el custom claim `admin`, que
se chequea al **emitirla** (`/api/admin/session`) y al **leerla**
(`getAdminSession`). Una cookie de usuario común pasa el proxy de `/admin` y
muere en `requireAdmin()`, que redirige a `/admin/login` — sin loop, porque el
proxy excluye esa ruta.

### 2. El chat se rediseña entero

Tres tipos de conversación, no uno:

| | Quiénes | Quién la crea |
|---|---|---|
| **Directa** | dos personas | cualquiera, escribiéndole a alguien |
| **Grupo** | N personas, con nombre | cualquier usuario con sesión |
| **Difusión** | el club a muchos, uno por uno | el admin, desde el panel |

Y tres decisiones dentro de eso:

**La difusión es fan-out con respuesta, no un canal de anuncios.** El admin
escribe una vez y se abre —o continúa— una conversación privada con **cada**
destinatario. Cada uno contesta sin ver a los demás. Es más caro que un
documento único con N participantes, pero un canal de sólo lectura ya existe y
se llama campanita: `notifyAll` manda avisos de una sola vía a todo el plantel
desde `contenido/`. Lo que justifica meter esto en el chat es justamente que
haya vuelta.

**Escribe una cuenta oficial del club, no el admin de turno.** Si el remitente
fuera la cuenta personal de quien apretó enviar, un aviso institucional llegaría
como *"Emanuel te escribió"*, y el día que administre otra persona el hilo
quedaría partido entre dos remitentes. La cuenta del club es un `UserDoc`
reservado, creado por el seed.

**UI nueva.** La conversación hoy usa el `Chatbot` de la librería, que modela
los mensajes como `user` / `bot`: dos participantes por definición, sin autor
por mensaje. Con grupos hay que mostrar quién escribió cada uno.

## Las fases

Cada fase deja la app funcionando. Ninguna depende de una posterior.

```
Fase 0  higiene ─┐
Fase 1  sesión ──┼─→ Fase 2  identidad ─┬─→ Fase 3  posts/comentarios ─┐
                 │                       ├─→ Fase 4  storage ──────────┼─→ Fase 7  cierre
                 │                       ├─→ Fase 5  chat ─────────────┤
                 └───────────────────────┴─→ Fase 6  push ─────────────┘
```

---

### Fase 0 — Higiene

Chica, pero primero: el working tree está sucio y confunde el punto de partida.

- Commitear el endurecimiento del voto que ya está hecho y sin commitear
  (`votarEncuesta` verificando `idToken`, `FeedTabs` con el contador `rechazos`
  que remonta el `<Poll>` cuando el servidor rechaza).
- Sacar `scratch_seed_body.ts` (48 KB sin trackear) del repo.
- Apuntar la sección *Qué falta* del README a este archivo.

### Fase 1 — La sesión del servidor

El cimiento. Sin esto ninguna fase posterior sabe quién es el usuario.

- **Generalizar el canje de token.** `/api/admin/session` ya hace todo el
  trabajo (verifica, chequea el claim, emite `createSessionCookie`, revoca en
  el `DELETE`). Se extrae el flujo a `/api/session` y la variante admin queda
  como el mismo endpoint con el chequeo de claim extra.
- **`sameSite` distinto según el módulo.** El panel usa `strict` y está bien:
  nadie llega a `/admin` desde un link externo. El público **no puede** usar
  `strict`: compartir `/post/:id` por WhatsApp abriría la app sin sesión en la
  primera navegación. Va `lax`.
- **`lib/session.ts` pasa a tener una mitad servidor**: `getCurrentUid()`
  (devuelve `null` sin sesión, para las pantallas públicas) y `requireUid()`
  (corta, para las actions). Mismo par que `getAdminSession` / `requireAdmin`,
  y por el mismo motivo: una Server Action es un POST invocable sin pasar por
  ninguna pantalla.
- **Login, alta y logout escriben y borran la cookie.** Incluye el retorno de
  `signInWithRedirect` de Google, que hoy vuelve por `onAuthStateChanged`.
- **Refresco.** La cookie dura 5 días (máximo de `createSessionCookie`); un
  `onIdTokenChanged` la vuelve a canjear antes de que expire.

**Primera prueba del mecanismo, en la superficie más chica:** el dedupe de votos.
`voto.ts` deja de recibir `idToken` por parámetro, lee el uid de la cookie y
ancla el voto a la persona — que es el "próximo paso" que el propio archivo se
dejó anotado. Hoy recargar y volver a votar suma de más.

### Fase 2 — Identidad única sobre el uid

- `authorOf()` en `queries.ts` deja de mirar `db.users` y lee
  `trapnexport-user`. Con caché por request: el feed pide el autor de cada post
  y sin agrupar son N lecturas por render.
- Los ids de dominio pasan de slug a uid: `Post.authorId`, `CommentRow.authorId`,
  `likedBy`, `savedBy`, `participantIds`.
- **El plantel no se pierde**: `UserDoc.playerId` ya es el puente entre la
  cuenta y `trapnexport-jugador`. La cuenta es de la persona, la ficha del
  plantel es del club, y son cosas distintas — eso ya está bien modelado.
- `getProfile(handle)` pasa a ser una query por `handle` (índice nuevo) en vez
  de un `find` en un array.
- Se borran `db.users` y `db.currentUserId`. `PerfilClient.tsx` deja de
  importar `db` — es el único componente que hoy lo hace.

Al terminar esta fase el store en memoria queda con `posts`, `comments` y
`conversations` nada más.

### Fase 3 — Publicaciones y comentarios

- **`PostDoc` y `CommentDoc` nuevos en `schema.ts`.** Es lo único del dominio
  que ese archivo no tiene todavía (`UserDoc`, `GalleryDoc`,
  `PushSubscriptionDoc` ya están escritos, esperando).
- **`likedBy` sí como array, `savedBy` no.** Los likes se muestran contados y
  se leen junto con el post; los guardados son privados, no tienen contador
  visible y hacen que guardar reescriba el documento que todo el feed está
  leyendo. `savedBy` va a `trapnexport-user/{uid}/saved/{postId}`.
- Contadores de `UserStats` con `FieldValue.increment` en la misma transacción
  que el alta, no recalculados: `firestore.rules` ya declara `stats` inmutable
  para el dueño justamente para que el número signifique algo.
- Índices nuevos: feed por `createdAt desc` filtrando `hidden`, comentarios por
  `postId`.
- Rules: `trapnexport-post` y `trapnexport-comment` con lectura pública
  (el feed es público) y escritura sólo del servidor, igual que el contenido
  del panel.
- Al borrar un post, borrar también sus imágenes del bucket: `PostMediaItem.path`
  existe exactamente para eso y hoy no lo usa nadie.

### Fase 4 — Avatares y carrete a Storage

Más chica de lo que era: `lib/storage/imagen.ts` ya existe y es el motor común
(`comprimirImagen`, `subirImagen`, `borrarImagen`) que usan el compositor del
feed y el panel de la historia. Lo que falta es engancharlo, no escribirlo.

- `lib/media-upload.ts` deja de producir data-URIs y llama a `subirImagen` con
  su propia carpeta. Su encabezado ya anticipó el cambio: *"las firmas no
  cambian: los componentes ya reciben un string y no saben si es data-URI o
  URL"*.
- El carrete pasa del array `User.gallery` a la subcolección
  `trapnexport-user/{uid}/gallery/{id}` — `GalleryDoc` ya está definido, y la
  razón también: un array embebido se relee entero en cada lectura del perfil
  *y del feed*, y choca contra el tope de 1 MB del documento con dos fotos.
- `UserDoc.avatarPath` empieza a usarse: sin eso, cambiar la foto deja la
  anterior huérfana en el bucket para siempre.
- **Cerrar la escritura de `storage.rules`.** Hoy las dos carpetas
  (`trapnexport-post/`, `trapnexport-historia/`) tienen
  `allow create, update` acotado sólo por tamaño y content-type, sin mirar
  `request.auth`: con la config pública del proyecto, cualquiera deposita
  archivos ahí. El comentario de la regla lo asume inevitable porque *"el panel
  se autentica con la cookie de sesión, no con Firebase Auth en el navegador,
  así que desde acá no hay `request.auth` que mirar"* — pero el login del panel
  **sí** pasa por Firebase Auth en el cliente antes de canjear la cookie, y el
  compositor del feed también. El claim está disponible; la regla puede exigir
  `signedIn()` para el feed y `request.auth.token.admin == true` para la
  historia, que es lo que la propia regla se deja anotado como paso siguiente.
  `allow delete: if true` tiene el mismo problema y el mismo arreglo.

### Fase 5 — Chat: rediseño

La fase más grande, y la única con UI nueva. Va en tres pasos, cada uno
entregable por su cuenta.

#### El modelo

```
trapnexport-conversacion/{id}
  tipo            "directa" | "grupo"
  participantIds  uid[]                      ← array-contains: ESTO es la bandeja
  nombre?         string                     ← sólo grupo
  avatar?         string · avatarPath?
  creadoPor?      uid                        ← sólo grupo
  ultimoMensaje?  { texto, autorId, at }     ← denormalizado
  lastReadAt      { [uid]: Timestamp }
  createdAt · updatedAt

  mensaje/{id}
    autorId   uid
    texto     string
    tipo      "texto" | "sistema"
    at        Timestamp
```

Cinco decisiones que vale la pena dejar escritas:

- **Los mensajes van en subcolección**, no en el array `Conversation.messages`
  de hoy. Una conversación activa supera el tope de 1 MB del documento, y hasta
  que lo supera se relee entera en cada lectura de la bandeja.
- **`ultimoMensaje` denormalizado.** Sin esto, listar la bandeja es una query
  más una subquery por conversación sólo para saber qué dice la última línea. Se
  escribe en la misma transacción que el mensaje.
- **`lastReadAt` es un mapa en el documento**, no una subcolección: el no leído
  sale de comparar contra `ultimoMensaje.at` sin leer un solo mensaje. Con el
  plantel entero como participante son decenas de entradas, muy lejos del tope.
  La contra es que hay que acotarlo en las rules — cualquier participante puede
  escribir el mapa entero, así que la regla exige que el diff toque **sólo su
  propia clave**.
- **La conversación directa lleva id determinístico**: los dos uid ordenados y
  concatenados. Sin eso, si dos personas se escriben por primera vez al mismo
  tiempo quedan dos conversaciones para el mismo par y los mensajes se parten
  entre las dos. Es el mismo problema que `trapnexport-handle` ya resuelve de la
  misma forma: la unicidad sale del id del documento, porque Firestore no tiene
  índices únicos. Los grupos sí llevan id aleatorio — el mismo conjunto de
  personas puede tener dos grupos distintos y eso es legítimo.
- **`tipo: "sistema"`** para *"Fulano agregó a Mengano"*. Sin un tipo, esos
  avisos habría que fabricarlos en la UI a partir de nada.

Índice nuevo: `participantIds array-contains` + `updatedAt desc`.

#### 5.1 — Directas, tiempo real y lecturas

Reemplaza el chat actual sin agregar funciones todavía.

- Las rules dejan de ser `if false`: la conversación se lee si
  `request.auth.uid in resource.data.participantIds`. Es la primera lectura
  directa del cliente a Firestore en el módulo social.
- La pantalla de conversación pasa a cliente con `onSnapshot`. La bandeja
  también, para que el badge baje solo.
- Las lecturas por persona reemplazan la heurística actual de
  `getConversations`, que define "no leído" como *"el último mensaje es del
  otro"*: con eso, entrar a la conversación no la marca leída y el badge de
  `getUnreadChats` no baja nunca.
- **Costo a tener en cuenta:** la regla de `mensaje/{id}` necesita un `get()` de
  la conversación padre para saber si sos participante, y cada `get()` en rules
  se factura como una lectura. En un chat en vivo es una lectura extra por
  mensaje. Se deja así porque es lo correcto y lo simple; si el número molesta,
  el arreglo es duplicar `participantIds` en cada mensaje, y conviene hacerlo
  recién ahí.

#### 5.2 — Grupos

- `participantIds` pasa de dos a N, con nombre y foto de grupo. Los crea
  **cualquier usuario con sesión**: sumar gente a un grupo es comportamiento
  normal de red social, y las rules ya garantizan que sólo un participante lo
  lea. La moderación la cubre el panel.
- Sumar y sacar participantes es un update acotado por rules, y deja un mensaje
  de sistema en el hilo.
- **Reemplazar el `Chatbot`**: hace falta autor por mensaje, avatar distinto por
  persona y mensajes de sistema. Ninguna de las tres entra en un modelo
  `user` / `bot`.
- FAB de "nuevo grupo" con selector de participantes; la bandeja mezcla directas
  y grupos ordenadas por `updatedAt`.

#### 5.3 — Difusión desde el panel

- **La cuenta del club.** Un `UserDoc` reservado que crea el seed con el Admin
  SDK: `verified: true`, handle `trapnexport` reservado en `trapnexport-handle`
  como cualquier otro. Nadie puede suplantarla — crear un `UserDoc` exige
  `isSelf(uid)` y no existe cuenta de Firebase Auth con ese uid, así que no hay
  con qué autenticarse como el club. Sí hay que **excluirla a mano** de
  `notifyAll` (no se notifica a sí misma), del buscador y de `/admin/usuarios`:
  es un remitente, no un usuario.
- **`/admin/mensajes`**, sección nueva del panel, con dos mitades: el compositor
  y la bandeja del club (`array-contains CLUB_UID`, ordenada por `updatedAt`).
  Responder desde el panel escribe como el club, vía Server Action con
  `requireAdmin()`.
- **El compositor elige destinatarios**: todos, sólo el plantel, o selección
  manual. El envío resuelve la lista y hace fan-out — por cada destinatario,
  buscar o crear la directa club↔persona y escribir el mensaje. En lotes de 450,
  igual que `notifyAll`, y por el mismo motivo: un batch de Firestore admite 500
  escrituras.
- **Registro de lo enviado** en `trapnexport-difusion/{id}`: texto, alcance,
  destinatarios resueltos, qué admin lo mandó y cuándo. No es el mecanismo de
  envío, es la auditoría — sin esto no hay forma de saber qué se comunicó.
- **El riesgo, dicho de frente:** una difusión a todos con respuesta abierta crea
  N conversaciones que alguien tiene que atender. Con el plantel (~26 cuentas)
  es perfectamente manejable. Si la app se abre a hinchas, deja de serlo — por
  eso el alcance es un filtro explícito y el default no debería ser "todos".

`notifyUser` sigue disparando el aviso de campanita `message` en los tres casos;
con la Fase 6 ese mismo punto dispara el push. Una difusión a todo el plantel
son, entonces, N mensajes + N notificaciones + N pushes: todo por lotes.

### Fase 6 — Push notifications

Es lo más verde de todo: hay claves VAPID en el entorno, `web-push` en
`package.json` y el tipo `PushSubscriptionDoc` escrito en `schema.ts`, pero
**cero líneas de código**. No hay una sola llamada a `pushManager.subscribe()`
y [`public/sw.js`](public/sw.js) no tiene handler de `push`.

- Handlers `push` y `notificationclick` en el service worker. El SW ya existe y
  ya está registrado (lo necesita `UpdatePrompt`), así que es sumarle eventos,
  no crearlo.
- Flujo de permiso en la app: pedirlo **después** de una acción que lo explique,
  nunca al cargar — un permiso pedido de entrada se niega y no se puede volver
  a pedir.
- `pushManager.subscribe()` con `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y guardado en
  subcolección bajo `trapnexport-user/{uid}/private/`. Es **lista y no
  documento único**: la misma persona tiene la PWA en el teléfono y la pestaña
  en la compu, y cada instalación tiene su endpoint propio.
- El envío se engancha en `lib/social/notify.ts`, que ya es el único punto por
  donde nace un aviso: `notifyUser` y `notifyAll` suman el push al lado de la
  escritura en Firestore. Ninguna action se entera.
- Limpieza: un endpoint que responde `410 Gone` es una instalación desinstalada
  y hay que borrar la suscripción, o la lista crece para siempre.

### Fase 7 — Cierre

- Se borra `lib/social/store.ts`.
- En `firestore.rules` desaparece el comentario del catch-all que dice *"el
  resto del dominio (publicaciones, comentarios, chat) todavía vive en el store
  en memoria"*. El `match /{document=**} { allow read, write: if false; }` se
  queda: una colección sin regla explícita no puede quedar abierta por olvido.
- Un `seed:social` opcional, en la línea de los cuatro seeds que ya existen.

---

## Lo que queda afuera

- **Offline / caché del service worker.** El SW no cachea a propósito y esa
  decisión no cambia acá.
- **Dorsal único.** `PlayerFicha.dorsal` admite repetidos y el README ya lo
  declara: *"único no está garantizado todavía"*.
- **Recompresión de video.** No hay forma en el navegador sin traer un
  transcoder; los videos se siguen validando sólo por tamaño.
- **Menciones.** `NotificationKind` tiene `mention`, pero nadie parsea `@handle`
  todavía.
