# Plan de migración

Este documento reemplaza a la sección *Qué falta* del [README](README.md). Está
escrito en presente de cuando se planificó, y cada fase lleva al final cómo
quedó: lo que salió distinto de lo previsto es la parte que vale la pena leer.

## Estado

**Hechas las fases 0 a 5 y la 7. Queda sólo la 6 (push).**

Ya no hay store en memoria ni identidad falsa: todo el dominio está en Firestore
y cada escritura la firma quien tiene la sesión. Lo que sigue abajo es el
registro de cómo se llegó ahí.

Lo único pendiente es push: hay claves VAPID en el entorno, `web-push` en
`package.json` y `PushSubscriptionDoc` escrito en el schema, y **cero líneas de
código** — `public/sw.js` no tiene handler de `push`.

Y algo que ninguna fase cubre: **nada de esto se probó en un navegador.**
`tsc`, ESLint y `next build` pasan, pero el comportamiento real —entrar, ver el
feed propio, publicar, chatear, recibir una difusión— está sin verificar.

## La decisión de fondo: una sola identidad

*(Escrito antes de empezar. Ya no es así: se resolvió en la Fase 2.)*

Había dos modelos de usuario en paralelo, y no se hablaban:

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

Hechas: 0, 1, 2, 3, 4, 5 y 7. Queda la 6 (push), que no depende de ninguna.
```

---

### Fase 0 — Higiene · **hecha**

Chica, pero primero: el working tree estaba sucio y confundía el punto de partida.

- El árbol se separó en tres commits (`d681cba` la historia del club a Firestore,
  `947b623` el endurecimiento del voto, `cfc182a` esta documentación) en la rama
  `plan-migracion`.
- `scratch_seed_body.ts` ya no estaba: se había borrado antes.
- La sección *Qué falta* del README apunta a este archivo.

### Fase 1 — La sesión del servidor · **hecha**

El cimiento. Sin esto ninguna fase posterior sabe quién es el usuario.

- **El canje se generalizó.** Todo el mecanismo vive ahora en
  `lib/auth/sesion.ts` —emitir, cerrar, verificar, `getCurrentUid()` y
  `requireUid()`— y las dos rutas son cáscaras: `/api/session` emite a cualquier
  cuenta con sesión válida, `/api/admin/session` es la misma llamada con
  `{ exigirAdmin: true }`. `lib/admin/auth.ts` dejó de tener su propia copia de
  la verificación y ahora sólo aporta el chequeo del claim.
- **`sameSite: lax` para los dos módulos.** Acá el plan estaba mal: decía
  `strict` para el panel y `lax` para el feed, y eso es imposible — hay **una
  sola cookie**, así que tiene un solo `sameSite`. Gana el caso que se rompe:
  con `strict`, abrir un `/post/:id` compartido por WhatsApp llega sin cookie y
  la persona ve su propia app deslogueada. `lax` tampoco viaja en un POST
  cross-site, que es lo que `strict` protegía de verdad.
- **La cookie se mantiene sola desde `AuthProvider`**, no desde las pantallas de
  login. Hay tres puertas de entrada —email, registro y Google— más el retorno
  de `signInWithRedirect`, que no pasa por ninguna pantalla; en cada una habría
  que acordarse. El listener pasó de `onAuthStateChanged` a `onIdTokenChanged`,
  que además avisa cuando Firebase rota el token cada hora: esa rotación es el
  momento de renovar la cookie, y es lo que hace que una sesión de cinco días no
  se caiga sola.
- **`loading` ahora espera también a la cookie.** Sin eso las pantallas de login
  navegan a un Server Component que todavía no la ve, y arma la pantalla como si
  no hubiera sesión: se ve deslogueado hasta recargar a mano. El canje y la
  primera lectura del perfil salen juntos, así que se espera el más lento de los
  dos y no la suma. Con tope de 8 s, o un request colgado dejaría la app en el
  splash para siempre.
- **Salir cierra las dos mitades.** `PerfilClient` ahora borra la cookie y
  espera la respuesta antes de `signOut` y de navegar, igual que ya hacía
  `SalirDelPanel`: dejarlo sólo en manos del listener es una promesa suelta que
  puede no haber terminado cuando el servidor arma la pantalla siguiente.

**Primera prueba del mecanismo, en la superficie más chica:** el dedupe de votos.
`votarEncuesta` perdió los parámetros `idToken` y `previos` — los dos los pone
ahora el servidor. El voto de cada persona es un documento en
`trapnexport-encuesta/{id}/voto/{uid}`, y que el id **sea** el uid es todo el
dedupe: Firestore no tiene índices únicos, así que la única forma de garantizar
un voto por cuenta es que el segundo caiga sobre el mismo documento que el
primero. De paso, votar dos veces lo mismo dejó de hacer nada, y cambiar de
opción resta de la opción vieja aunque hayas recargado.

### Fase 2 — Identidad única sobre el uid · **hecha**

- **`lib/social/directorio.ts`** es lo que reemplaza a `db.users`: lee
  `trapnexport-user` y devuelve `Cuenta`, con el uid de id. Trae la colección
  entera y no cuenta por cuenta, porque el feed pide el autor de cada
  publicación, de cada comentario y de los tres primeros likes: de a uno son
  decenas de lecturas por render, casi todas repetidas. Va envuelto en `cache()`
  de React, que memoiza **por request**, así una pantalla que llama a `getFeed`,
  `getSession` y `getNotifications` lee las cuentas una vez y no tres. El techo
  queda escrito en el archivo: con cientos de cuentas esto pasa a ser un
  `getAll()` de los uid de la pantalla, y no cambia ninguna firma.
- **Sin índice nuevo.** El plan decía que `getProfile(handle)` iba a ser una
  query por `handle`; como el directorio ya trae todo, se indexa en memoria y no
  hace falta ni la query ni el índice.
- Los ids de dominio pasan de slug a uid: `authorId`, `likedBy`, `savedBy`,
  `fromId`, `participantIds`. No hubo que migrar datos: el store arrancaba vacío.
- **El plantel no se pierde**: `profile.playerId` es el puente. `perfil/page.tsx`
  emparejaba `profile.id` contra `JUGADORES` y `getPlayer()`, y eso se rompía —
  ahora `profile.id` es un uid y esas dos se indexan por el slug del jugador.
- Se borraron `db.users` y `db.currentUserId`. También los tipos `User` y
  `TeamClaim` de `social/types.ts`, que quedaron huérfanos y eran una trampa:
  dos tipos casi iguales con el campo `id` significando cosas distintas.
- El carrete pasó a `db.gallery`, un mapa por uid, porque ya no hay objeto
  usuario donde colgarlo. Es transitorio: se va a Storage en la Fase 4.

**Lo que apareció al hacerlo.** La sesión pasó a ser opcional de punta a punta
(`SessionVM | null`), y eso es correcto: el feed, un perfil y una publicación se
ven sin cuenta porque están hechos para compartirse por link. Lo que cambia es
que no se dibujan los controles que escriben — el compositor no aparece, el FAB
del foro manda a `/login` y la caja de comentarios también.

Y aparecieron tres cortes que antes no podían existir, porque con todos
escribiendo como la misma cuenta semilla no había nada que separar:

- `deleteComment` ahora exige ser el autor. Sin eso, cualquiera borraba el
  comentario de cualquiera con un POST.
- `getConversation` y `sendMessage` exigen ser participante. Sin eso, cualquiera
  con el id leía y escribía en la conversación de otros dos.
- `/perfil` corta en el servidor. Antes el gate era de cliente y no podía ser
  otra cosa: los datos viajaban igual aunque no se dibujaran.

Al terminar esta fase el store en memoria queda con `posts`, `comments`,
`conversations` y el carrete.

### Fase 3 — Publicaciones y comentarios · **hecha**

- **`PostDoc`, `CommentDoc` y `GuardadoDoc`** en `schema.ts`; `trapnexport-post`
  y `trapnexport-comment` en `COL`.
- **`likedBy` sí como array, `savedBy` no**, como estaba previsto. Los likes se
  cuentan y se muestran, así que se leen junto con la publicación; guardar es
  privado y sin contador, y si viviera en el post cada "guardar" reescribiría el
  documento que todo el feed está leyendo. Quedó en
  `trapnexport-user/{uid}/saved/{postId}`, con el id de la publicación como id
  del documento: guardar dos veces es idempotente.
- **Los likes van con `arrayUnion`/`arrayRemove`**, no reescribiendo el array.
  Dos personas dando like a la vez con la lista completa se pisan y uno de los
  dos likes desaparece; estas dos las resuelve el servidor de Firestore sobre el
  valor actual.
- **`hidden` es obligatorio, no opcional.** El feed consulta
  `where("hidden", "==", false)` y una query de igualdad **no devuelve** los
  documentos a los que les falta el campo: con `hidden?` las publicaciones
  nuevas no aparecerían nunca.
- **`commentCount` desnormalizado** en la publicación. El feed muestra
  "Comentarios (N)" en cada tarjeta y contarlos de verdad sería una query por
  publicación en pantalla. Lo mueven `addComment` y `deleteComment` con
  `increment`, en el mismo lote que el alta o la baja — separados, un error en
  el medio dejaría el número mintiendo.
- **Contadores de `UserStats` en el mismo lote**, igual.
- **Los comentarios del feed salen en una query**, no en una por publicación:
  `where("postId", "in", [...])` en tandas de 30, que es el tope de Firestore.
- **`/admin` pasó a agregaciones.** Los contadores del panel recorrían el array
  entero; en Firestore eso sería leer y pagar la colección completa cada vez que
  alguien abre el panel. Ahora son `count()`, y el sparkline consulta sólo la
  última semana.
- **Al borrar una publicación se borran sus imágenes.** `PostMediaDoc.path`
  existía desde que el compositor sube a Storage y no lo usaba nadie. Va con el
  Admin SDK (`borrarDelBucket`, nuevo en `lib/firebase/admin.ts`) porque quien
  aprieta el botón es el panel y no el dueño de los archivos, y va **después** de
  borrar los documentos: al revés, un fallo en el medio dejaría una publicación
  viva apuntando a fotos que ya no existen.
- Rules: lectura pública y escritura cerrada al cliente. La escritura no se abre
  al autor aunque "podría": ninguna de estas operaciones es un documento solo, y
  `stats` es de sólo lectura para su dueño a propósito.
- Índices nuevos: `hidden`+`createdAt`, `authorId`+`hidden`+`createdAt`,
  `postId`+`createdAt`.

**Lo que apareció:** `setPostHidden` y `deletePost` no exigían nada. Estaban en
el archivo del feed y no en el del panel, así que se saltearon el
`requireAdmin()` que tiene el resto de la moderación — cualquiera podía ocultar o
borrar la publicación de cualquiera con un POST. Ahora lo exigen.

### Fase 4 — Avatares y carrete a Storage · **hecha**

Más chica de lo que era, porque `lib/storage/imagen.ts` ya existía como motor
común. Lo que hubo que sumarle es `subirArchivo`, que sube sin comprimir: es
para el video del carrete, que no se puede recomprimir en el navegador sin traer
un transcoder entero.

- `lib/media-upload.ts` dejó de producir data-URIs. Ahora expone `uploadAvatar`
  y `uploadMedia`, que suben al bucket y devuelven `{ src, path }`. Por la
  Server Action viaja sólo eso.
- El carrete pasó del mapa en memoria a `trapnexport-user/{uid}/gallery/{id}`.
- **`UserDoc.avatarPath` empezó a usarse**, y con él el borrado de la foto
  anterior: sin eso cada cambio de avatar dejaba un archivo que nadie
  referenciaba y que ya no se podía encontrar, porque el nombre es al azar y la
  única pista era el `avatarPath` que se acababa de pisar. Volver a un avatar
  generado borra el campo con `deleteField()`, no lo deja en `undefined`.
- `stats.gallery` se mueve con `increment`, en el mismo lote que el alta o la
  baja.

**`storage.rules` cerrado.** Era lo más grave que quedaba: las dos carpetas
tenían `allow create, update` acotado sólo por tamaño y content-type, y
`allow delete: if true`, sin mirar `request.auth` — con la configuración pública
del proyecto, que viaja en el bundle como corresponde, cualquiera podía llenar o
vaciar el bucket. El comentario de la regla lo daba por inevitable porque *"el
panel se autentica con la cookie de sesión, no con Firebase Auth en el
navegador"*; es cierto que la cookie es lo que valida el servidor, pero el login
del panel pasa por Firebase Auth en el cliente antes de canjearla, así que el
token existe y el claim también.

Ahora: el `{userId}` del path es lo que exige que cada quien escriba en su propia
carpeta, la historia del club pide el claim `admin`, el borrado es del dueño o
del panel, y hay un `match /{allPaths=**}` que cierra todo lo demás.

**Consecuencia a tener en cuenta:** subir al panel de historia ahora requiere que
el navegador tenga sesión de Firebase Auth con el claim, no sólo la cookie. Es lo
correcto, pero si alguien queda con la cookie viva y la sesión del cliente caída,
las subidas fallan con "tu sesión venció" en vez de funcionar.

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

**Estado: hecha.** Lo que salió distinto de lo planeado está anotado al final de
esta sección.

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

#### Cómo quedó

El módulo entero vive en `lib/chat/` —`queries.ts`, `actions.ts` y `vivo.ts`—
en vez de dentro de `social/`: tres tipos de conversación con lecturas por
persona y tiempo real no entraban como un apartado de un archivo que ya tenía el
feed.

Lo que salió distinto de lo escrito arriba:

- **El FAB hace las dos cosas.** El plan preveía un "nuevo grupo" aparte. Quedó
  uno solo: se eligen personas de una lista y con una es una directa, con dos o
  más es un grupo. Dos botones separados obligaban a decidir *antes* de saber a
  quién se quería escribir, que es al revés de como se piensa.
- **`getUnreadChats` devuelve conversaciones con algo sin leer, no mensajes.**
  Saber *si* hay algo nuevo sale de comparar `lastReadAt` contra
  `ultimoMensaje.at`, sin leer un solo mensaje; el número exacto costaría una
  query por conversación y la bandeja dibuja un punto, no una cifra.
- **`marcarLeida` se dispara también con cada mensaje nuevo**, no sólo al abrir.
  Marcando sólo al entrar, un mensaje que llega con la pantalla abierta quedaba
  contando como no leído para siempre.
- **La cuenta del club lleva rol propio** (`role: "club"`) y un seed nuevo
  (`npm run seed:club`). No es un permiso —`/admin` se sigue gateando por el
  claim— sino lo que permite excluirla de donde se listan cuentas: el buscador,
  `notifyAll` y `/admin/usuarios`. Su handle se reserva en `trapnexport-handle`
  como cualquier otro, o alguien podría registrarse como @trapnexport y hacerse
  pasar por el club en el feed.
- **El compositor arranca en "sólo el plantel", no en "todos".** El riesgo que el
  plan anotaba —N conversaciones que alguien tiene que atender— se acota mejor
  con un default prudente que con una advertencia.
- **La respuesta del panel se abre en la misma fila** y no en un modal: el
  contexto de la conversación es la línea de arriba, y taparla obliga a
  recordarla.

Y una decisión de costo que quedó tomada a conciencia: la regla de
`mensaje/{id}` hace un `get()` de la conversación padre para saber si sos
participante, y **cada `get()` en rules se factura como una lectura**. En un chat
en vivo es una lectura extra por mensaje. La alternativa es duplicar
`participantIds` en cada mensaje, que es un dato repetido que hay que mantener
sincronizado al sumar o sacar gente de un grupo. Se deja el `get()`; si el número
molesta, ese es el arreglo y conviene hacerlo recién ahí.

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

### Fase 7 — Cierre · **hecha**

- **`lib/social/store.ts` ya no existe.** Se vació solo: las cuentas se fueron en
  la Fase 2, las publicaciones y los comentarios en la 3, el carrete en la 4 y el
  chat en la 5. Cuando quedó sin nada adentro, borrarlo fue sacar el archivo y
  dos imports.
- También se fueron los tipos que lo acompañaban en `social/types.ts` —`User`,
  `TeamClaim`, `Post`, `CommentRow`, `Message`, `Conversation`—, cada uno
  reemplazado por su `*Doc` del schema. En su lugar quedó un comentario que dice
  qué había y por qué se fue: son los tipos que alguien va a buscar.
- En `firestore.rules` desapareció el comentario del catch-all que hablaba del
  store en memoria. El `match /{document=**} { allow read, write: if false; }` se
  queda: una colección sin regla explícita no puede quedar abierta por olvido.
- El `seed:social` que figuraba como opcional **no se hizo**, y conviene que
  siga sin hacerse: el feed arranca vacío a propósito y se llena con lo que la
  gente publica. El seed que sí entró es otro, `seed:club`, y no es contenido de
  muestra sino una cuenta que la app necesita para funcionar.

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
