# Trap N Export

App Next.js 16 (App Router, Tailwind v4) con **dos módulos separados** que
comparten dominio, datos y tema, pero nada de su chrome:

| | `/` — red social | `/admin` — panel |
|---|---|---|
| Para quién | usuarios finales | moderación |
| Forma | PWA mobile-first, app-like | escritorio, tabla y formulario |
| Shell | `src/app/(app)/AppShell.tsx` | `src/app/admin/AdminShell.tsx` |
| Navegación | `BottomNav` (4 rutas, `md:hidden`) | `SideBar` en ≥`md`, `Navbar` debajo |
| Plataforma | splash, safe areas, instalador, notificaciones | nada de eso |
| Indexación | `/post/:id`, `/u/:handle` y `/historia` | `noindex` siempre |

El módulo público sigue la guía
[`red-social.md`](https://github.com/EmaDev/kit-componentes/blob/main/docs/guides/red-social.md)
de `lib-kit-components`. Los desvíos están abajo, en
[Desvíos respecto de la guía](#desvíos-respecto-de-la-guía).

## Arranque

```bash
cp .env.example .env.local     # completá lo que uses; nada es obligatorio para correr
npm run dev                    # http://localhost:3000
```

- `npm run build` / `npm run start` — build de producción.
- `npm run lint` — ESLint.
- `npm run icons` — regenera `public/icons` desde los colores de `globals.css`.

## Paleta

Un solo color de marca sobre neutros puros:

| Token | Claro | Oscuro |
|---|---|---|
| `primary` | `#50108b` | `#b986ea` |
| `primary-hover` | `#3d0a6b` | `#cfa8f2` |
| `accent` (el mismo violeta aclarado, para los degradés) | `#752eb8` | `#c8a2eb` |
| `surface` / `surface-alt` | `#ffffff` / `#f5f5f5` | `#0a0a0a` / `#171717` |
| `foreground` / `muted` | `#0a0a0a` / `#595959` | `#f5f5f5` / `#a3a3a3` |
| `border` | `#e5e5e5` | `#2a2a2a` |

Los grises son neutros a propósito, sin tinte: con un único color de marca,
cualquier temperatura en el gris compite con el violeta. En oscuro el primario
se aclara manteniendo el tono (271°) — `#50108b` sobre negro da 1.7:1.

Todo sale de `src/app/globals.css`. Hay tres lugares que **no** leen esos
tokens y hay que actualizar a mano si la paleta cambia (los tres están
comentados en su archivo):

- `HEADER_BRAND_GRADIENT` en `src/app/(app)/FeedClient.tsx` — el degradé de
  `AppHeaderCardSlot` viene hardcodeado en la librería.
- `theme_color` en `public/manifest.json` y `viewport.themeColor` en
  `src/app/layout.tsx`.
- `FROM` / `TO` en `scripts/generate-icons.mjs` → correr `npm run icons`. Ese
  script también duplica la geometría de `public/escudo.svg` (ver
  [El escudo](#el-escudo)).

Los avatares y la media generados (`src/lib/media.ts`) se quedan en el tono
271° y varían sólo en luminosidad: con hues al azar, el feed sería un arcoíris
y la paleta dejaría de existir justo en la pantalla principal.

## Mapa de rutas

```
src/app/
  layout.tsx                    Server · <html>/<body> + metadata base. Sin chrome.
  not-found.tsx                 404 global.
  proxy.ts (src/proxy.ts)       Guard de /admin: noindex + corte por sesión.

  (app)/                        ── MÓDULO PÚBLICO ──────────────────────────
    layout.tsx                  Server · resuelve sesión/notificaciones y delega.
    AppShell.tsx                Client · el ÚNICO "use client" de arriba.
    notifications-context.tsx   Client · campana + sesión para cada pantalla.
    page.tsx                    /              Feed        AppHeaderCardSlot + SocialPost[]
    foro/page.tsx               /foro          Foro: los posteos de la comunidad
                                               FAB que abre el compositor en una hoja
    chat/page.tsx               /chat          Bandeja: directas y grupos (empujada)
    chat/[id]/page.tsx          /chat/:id      Conversación en vivo (onSnapshot)
    buscar/page.tsx             /buscar        Búsqueda de cuentas y publicaciones
    historia/page.tsx           /historia      Historia del club: 7 secciones en scroll
    historia/[year]/page.tsx    /historia/:año Temporada en detalle · generateMetadata
    perfil/page.tsx             /perfil        Perfil propio (AppHeaderCardSlot + stats)
    post/[id]/page.tsx          /post/:id      Detalle · generateMetadata + OpenGraph
    u/[handle]/page.tsx         /u/:handle     Perfil público · generateMetadata
    notificaciones/page.tsx     /notificaciones  Historial completo ("Ver todas")

  invitacion/[code]/page.tsx    /invitacion/:code  Tarjeta de invitación · noindex
                                                   Fuera de (app): es una landing,
                                                   no una pantalla del shell.

  admin/                        ── MÓDULO PRIVADO ──────────────────────────
    layout.tsx                  Server · noindex + sesión (sin redirigir)
    AdminShell.tsx              Client · SideBar + Navbar + Snackbar propio
    page.tsx                    /admin                 Panel: usuarios + accesos rápidos
    noticias/page.tsx           /admin/noticias        ABM · publicar/borrador
    encuestas/page.tsx          /admin/encuestas       ABM · borrador→abierta→cerrada
    invitaciones/page.tsx       /admin/invitaciones    ABM · genera el link y la tarjeta
    cronograma/page.tsx         /admin/cronograma      ABM · calendario + lista
    historia/page.tsx           /admin/historia        Las 7 secciones de /historia, en solapas
    presentacion/page.tsx       /admin/presentacion    La gala, a pantalla completa
    mensajes/page.tsx           /admin/mensajes        Difusión del club + bandeja de respuestas
    usuarios/page.tsx           /admin/usuarios        DataTable · suspender/reactivar
    publicaciones/page.tsx      /admin/publicaciones   DataTable · ocultar/borrar
    login/page.tsx              /admin/login           Login del panel (canjea la cookie)
```

El límite cliente/servidor está en los dos `*Shell.tsx`, **no** en los layouts ni
en las páginas: cada pantalla sigue siendo Server Component `async`, hace `await`
de sus datos y puede exportar `generateMetadata`.

## Capa de datos

Un solo origen para los dos módulos. El panel no tiene datos propios: lee y
escribe exactamente lo mismo que el feed.

```
src/lib/social/types.ts       Lo que queda del modelo propio: PlayerFicha, GalleryItem, NotificationKind. Las entidades son *Doc en firebase/schema.ts.
src/lib/social/directorio.ts  Las cuentas de trapnexport-user, cacheadas por request. Reemplazó al array de usuarios en memoria.
src/lib/social/queries.ts     Lecturas (feed, posts, comentarios, perfiles, notificaciones), ya mapeadas a los props.
src/lib/social/actions.ts     Escrituras como Server Actions, con el uid sacado de la cookie.
src/lib/social/notify.ts      Alta de avisos de campanita → Firestore (trapnexport-notification).

src/lib/chat/queries.ts       Bandeja, encabezado y mensajes; la bandeja del club para el panel.
src/lib/chat/actions.ts       Enviar (texto y foto), crear grupos, marcar leído y la difusión del panel.
src/lib/chat/vivo.ts          Client · las escuchas onSnapshot. La ÚNICA lectura directa del navegador a Firestore.

src/lib/auth/sesion.ts        Server · la cookie __session: emitir, cerrar, verificar, getCurrentUid/requireUid.

src/lib/historia/types.ts      Modelo de la historia del club (ClubIdentity, Era, Season, Player…). Tipos puros: los importa también el cliente.
src/lib/historia/seed.ts       La historia de arranque, tal como estaba escrita a mano. Hoy es semilla y fallback, no la fuente de verdad.
src/lib/historia/queries.ts    Lecturas de Firestore (Admin SDK), con fallback a la semilla por colección.
src/lib/historia/actions.ts    Escrituras como Server Actions, cada una con requireAdmin().
src/lib/historia/index.ts      Barrel client-safe: tipos + constantes. NO reexporta queries/actions.

src/lib/contenido/types.ts     Modelo del contenido del panel + etiquetas compartidas.
src/lib/contenido/store.ts     Generadores de id/código. El resto migró a Firestore.
src/lib/contenido/queries.ts   Lecturas de Firestore (Admin SDK), mapeadas a las filas del panel.
src/lib/contenido/actions.ts   Escrituras a Firestore como Server Actions, cada una con requireAdmin().
```

`contenido/` ya está sobre Firestore: `trapnexport-noticia`, `-encuesta`,
`-invitacion`, `-evento` y el doc `trapnexport-config/cronograma` (el día que
comparten los eventos). Todo pasa por el Admin SDK —lecturas en Server
Components, escrituras en Server Actions detrás de `requireAdmin()`— así que
`firestore.rules` deja esas colecciones cerradas al cliente. `npm run
seed:contenido` carga **sólo** las encuestas de los Trap Awards (idempotente: no
pisa votos); noticias, invitaciones y el día del cronograma nacen vacíos y se
cargan desde `/admin` (el cronograma cae a "hoy" hasta que se elija fecha).

`historia/` también está sobre Firestore, en siete colecciones:
`trapnexport-historia/club` (identidad + palmarés + balance, una sola fila),
`-era`, `-temporada` (el id **es** el año, que es la URL), `-historia-jugador`
(el id es el slug, que es el `?jugador=` compartible), `-frase`, `-foto` y
`-clip`. Todo se edita en `/admin/historia`.

No tiene script de seed y no le hace falta: mientras una colección está vacía,
`historia/queries.ts` sirve `historia/seed.ts`, así que la app cuenta la
historia completa en un proyecto de Firebase recién creado. La primera
escritura sobre una sección la siembra sola (`sembrarSeccion`), y el botón
"Importar contenido actual" del panel hace las siete de una vez. Es idempotente
en los dos caminos: una colección con algo adentro no se toca.

Las imágenes van a Firebase Storage, a `trapnexport-historia/`
(`lib/storage/historia-image.ts`, mismo motor que las fotos del feed). El
selector del panel acepta subir un archivo **o** pegar una URL: lo segundo es lo
que deja conservar los data-URI generados de `lib/media.ts` sin tener que
reemplazar cien imágenes de relleno antes de corregir un epígrafe.

`contenido/` es un módulo aparte de `social/` y no una carpeta más adentro: son
dos ciclos de vida distintos. `social/` lo escriben los usuarios y el panel sólo
lo **modera**; `contenido/` lo escribe **sólo** el panel —noticias, encuestas,
invitaciones, cronograma— y la app lo lee. Comparten el patrón (store en
`globalThis`, par `queries`/`actions`, pantallas que no tocan el store) pero no
la colección.

Las fechas de calendario van como `"YYYY-MM-DD"` y las horas como `"HH:mm"`, en
strings y no en timestamps: un evento ocurre a las 21:00 **en la cancha**, no en
un instante UTC. `fromISODate` en `src/lib/time.ts` es el único lugar que las
convierte a `Date`, y existe porque `new Date("2026-09-12")` parsea como UTC
medianoche y en Argentina devuelve el día anterior.

Las pantallas nunca tocan Firestore: piden un view-model a `queries.ts` y mutan
por `actions.ts`. Eso fue lo que permitió migrar el dominio entero sin tocar una
sola pantalla — se reescribió el cuerpo de esas dos capas y las firmas quedaron
iguales. **Ya no queda store en memoria**: cuentas, publicaciones, comentarios,
carrete, chat y notificaciones son documentos.

La única excepción a "las pantallas no tocan Firestore" es la conversación, que
se engancha con `onSnapshot` desde el navegador (`lib/chat/vivo.ts`): sin eso los
mensajes no llegarían solos. Es sólo lectura, y por eso es la única parte del
dominio con reglas de lectura para el cliente.

Un mensaje puede ser texto o **foto** (`MensajeDoc.tipo`). El archivo lo sube el
navegador directo a `trapnexport-chat/{uid}/` con el mismo motor que las fotos
del feed (`lib/storage/chat-image.ts`, lado largo 1080); por la Server Action
`sendImage` viaja sólo la `downloadURL`, la ruta del bucket y **las medidas** —
que están para que la burbuja tenga alto antes de que la imagen cargue y el hilo
no pegue un salto. `sendImage` no le cree al cliente: valida que la ruta empiece
con la carpeta propia y que el host sea de Firebase, o cualquiera podría meter
por POST una imagen de otro sitio dentro de una conversación.

**Ojo con la privacidad de esas fotos**: como todo el bucket, la lectura es
pública. Lo que las protege es el token imposible de adivinar que Firebase mete
en la `downloadURL`, no un permiso — quien reciba el link la ve sin estar en la
conversación. Cerrarlo de verdad significa servirlas desde el servidor con URLs
firmadas, y eso es otra decisión, no un ajuste.

Las fotos de las conversaciones van a `trapnexport-chat/` y no a
`trapnexport-post/` aunque compartan el motor: el path es lo que
`storage.rules` usa para acotar quién escribe dónde, y mezclarlas dejaría las
fotos de un chat privado bajo la misma regla que las de un feed público.

Los avatares generados siguen siendo **data-URI SVG** de `src/lib/media.ts`,
deterministas por handle: son el valor por defecto de una cuenta sin foto. Las
fotos de verdad —avatar, carrete, publicaciones, historia— van a Firebase
Storage y lo que se guarda es la `downloadURL` más la ruta del archivo.

Para `/historia` hay tres generadores más en el mismo archivo: `photoUrl` (foto
de archivo en 16:9), `playerPhotoUrl` (retrato 3:4) y `clipUrl` (portada de clip, que con `playing` devuelve el mismo SVG animado con
SMIL — corre dentro de un `<img>`, sin script ni recursos externos). `photoUrl`
y `clipUrl` **no** graban texto adentro: todos sus consumidores dibujan su
propia etiqueta encima y se superponían.

## `/admin` es privado, pero todavía no autentica

A pedido: la puerta está construida, falta la cerradura. Hoy cualquiera con el
link entra, y el panel lo dice en un cartel rojo arriba de todo.

Lo que **sí** está:

- `src/proxy.ts` — con `ADMIN_AUTH_ENABLED=true` redirige a `/admin/login`
  cuando falta la cookie `__session`, antes de renderizar nada. Siempre agrega
  `X-Robots-Tag: noindex, nofollow`.
- `src/lib/admin/auth.ts` — `requireAdmin()` es el único punto por donde el
  panel obtiene identidad, y va en la primera línea de cada página.
- `metadata.robots` en `noindex, nofollow, nocache` para todo `/admin`.
- `/admin/login` existe para que el guard tenga a dónde redirigir.

Para cerrarlo (en orden):

1. Endpoint que canjea el `idToken` de Firebase por una session cookie
   (`createSessionCookie`) y la escribe como `__session`.
2. Reemplazar el `TODO(firebase)` de `src/lib/admin/auth.ts` por
   `verifySessionCookie` + chequeo del custom claim `admin`.
3. `ADMIN_AUTH_ENABLED=true` en el entorno.

`firebase` y `firebase-admin` ya están en `package.json`; las variables, en
`.env.example`.

## Las nueve piezas obligatorias de la guía

| # | Pieza | Dónde |
|---|---|---|
| 1 | `SnackbarProvider` + `useSnackbar` | `AppShell` (envoltorio más externo, `gap={80}`) |
| 2 | `SplashScreen` + `useSplash` | `AppShell` (`until: loadSession`) |
| 3 | `SafeArea` | `AppShell` (`edges={["left","right"]}`, `fillViewport`) |
| 4 | `PwaInstallPrompt` | `AppShell` (oculto mientras el drawer está abierto) |
| 5 | `AppHeaderCardSlot` | `/` (compositor) y `/perfil` (stats) |
| 6 | `NotificationSidebar` | `AppShell`, una vez; la campana es una `action` de cada header |
| 7 | `BottomNav` | `AppShell`: feed · foro · historia · perfil |
| 8 | `SocialPost` | feed, perfil, `/u/:handle` y detalle — ver desvío 1 |
| 9 | `ShareButton` + `BottomSheet` | `SharePostSheet` en el feed; `ShareButton` suelto en el detalle |

Detalles de la guía que están respetados y son fáciles de romper después:

- `gap={80}` en el `SnackbarProvider` = 64px de `BottomNav` + aire. Con el
  default (16) la snackbar queda debajo de la nav.
- `SafeArea` sin `"top"` (lo aplica `AppHeaderCardSlot`) ni `"bottom"` (lo
  reserva `BottomNav` midiendo su alto real). No agregar `pb-20` a mano.
- El tab activo se resuelve **por sección** en `AppShell`: `BottomNav` compara
  `pathname === href`, así que sin eso `/post/123` no marca ningún tab.
- La campana va con `badge: unread || false`. Un `0` pelado dibuja un badge
  rojo con un "0" adentro.
- `/chat` entero esconde el `BottomNav` (la bandeja y la conversación): los
  mensajes directos dejaron de ser un tab y se abren desde el header.
- El badge de mensajes sin leer lo dibuja la acción de sobre de cada header, no
  la nav: viaja por `NotificationsCtx` (`unreadChats`) porque las pantallas son
  Server Components y la acción se arma en el cliente.
- El degradé violeta de `AppHeaderCardSlot` está hardcodeado en la librería: se
  pisa con `!bg-[linear-gradient(...)]` (`HEADER_BRAND_GRADIENT` en
  `FeedClient.tsx`), no cambiando los tokens del tema.
- Las `url` que recibe `ShareButton` son absolutas y coinciden con el
  `canonical` de esa ruta.

## Desvíos respecto de la guía

**1 · La caja de comentarios del feed es un `CommentBox`, no la incluida en
`SocialPost`.** La guía describe un `SocialPost` con caja propia (`comments`,
`onAddComment`, `currentUser`, `visibleComments`). La versión de
`lib-kit-components` instalada (`0.1.0`) **no tiene esas props**: su
`SocialPostProps` termina en `children`. Así que la caja va siempre en el slot
`children`, en dos configuraciones (`src/components/organisms/PostCard.tsx`):

- feed → `pageSize={2}`, sin hilos ni orden;
- detalle → `allowReplies`, orden y borrar.

Se cumple igual la regla dura de la guía —nunca dos cajas de escritura en el
mismo post— y el día que la librería se actualice, cambia sólo ese archivo.

**2 · La conversación de chat usa `Chatbot variant="inline"`.** La librería no
trae mensajería directa. `Chatbot` da el hilo, pero modela los mensajes como
`role: "user" | "bot"`: alcanza para una conversación de dos —"bot" es la otra
persona— y no sirve para grupos. Es un andamio consciente, no la pantalla final.

**3 · Se suma `UpdatePrompt`, que no está en las nueve.** Registra el
`/sw.js` (requisito de Chrome para que la app sea instalable y, por lo tanto,
para que `PwaInstallPrompt` aparezca) y avisa cuando hay versión nueva. Se
oculta junto con el instalador mientras el drawer de notificaciones está
abierto, por el mismo choque de z-index.

**4 · `CountdownHero` es un componente propio, no de la librería.** La card del
`AppHeaderCardSlot` del feed lleva una cuenta regresiva al lanzamiento
(`src/components/organisms/CountdownHero.tsx`). `lib-kit-components` **no tiene**
un hero de countdown: lo más cercano es `CountdownBanner`, que es otra cosa —una
barra de campaña fijable y descartable, con cajas de `h-9`/`text-sm` y **sin**
prop `size`—. Llegar a `size="xl"` con ese componente era pisarle clases
internas que se rompen en cualquier update, así que se escribió acá con la API
que hacía falta (`variant`, `size`, `tone`) y un solo archivo para borrar el día
que la librería sume el suyo.

La fecha sale de `LAUNCH_DATE` en `src/lib/site.ts`, configurable con
`NEXT_PUBLIC_LAUNCH_DATE`.

**5 · El feed no tiene compositor.** (Publicar vive en el FAB del foro y en el
compositor del perfil — ver el desvío 8.) La guía pone un `QuickComposer` en la card
del `AppHeaderCardSlot`; acá esa card la ocupa el countdown y el compositor se
sacó por pedido explícito. En su lugar, arriba de la columna del feed van un
`Carousel` de portada (5 slides, `autoplay` de 5 s) y un `TabsGlow` con
Encuesta · Cronograma · Noticias (`src/components/organisms/FeedTabs.tsx`).
`TabsGlow` es siempre controlado, así que el tab activo es estado de ese
componente y no de la pantalla. Consecuencia a tener en
cuenta: **desde el feed no se puede publicar**. `QuickComposer.tsx` se eliminó
por estar sin usar; la Server Action `publishPost` sigue en
`src/lib/social/actions.ts`, así que reponer un compositor es escribir el
formulario y llamarla.

El `autoplay` del `Carousel` se apaga con `prefers-reduced-motion`: la librería
pausa al hover y al arrastrar, pero no mira esa preferencia, y un carrusel que
avanza solo es justo lo que esa preferencia pide frenar.

**6 · Explorar se partió en dos.** La vieja `/explorar` hacía dos cosas —buscar
y sugerir cuentas— y su lugar en el `BottomNav` lo tomó `/historia`, la historia
del club (ver [Historia del club](#historia-del-club)). La búsqueda pasó a
`/buscar`, ruta propia a la que se llega por la lupa del header del feed y no
por la nav: buscar no es un destino donde uno se queda. Las cuentas sugeridas no
sobrevivieron a la mudanza.

`SearchFilters` va **sin** `filters`: los chips de filtro que dibuja no llegan a
filtrar nada (su predicado termina en `|| true`). Queda sólo la búsqueda por
texto, que sí funciona. Y `getSearchIndex()` excluye las cuentas suspendidas: si
el feed no las muestra, el buscador no puede ser la puerta de atrás.

El tab de la nav dice "Historia" y no "Historia del club" porque son cuatro
ítems y en 360px un label de tres palabras se corta. A diferencia del resto del
módulo público, `/historia` y `/historia/:año` **sí se indexan**: no son de
sesión, son iguales para todos.

**7 · `/foro`, `/chat` e `/historia` no llevan `AppHeaderCardSlot`.** Esa
cabecera existe para colgarle una card y en las tres lo que va debajo del
título es una lista o el cuerpo editorial, no una card. Llevan `AppHeader` con
`largeTitle`, que es la cabecera correcta para una bandeja, un foro y una
pantalla editorial.

**8 · El chat salió del `BottomNav` y entró el foro.** La nav sigue teniendo
cuatro rutas —feed · foro · historia · perfil—, pero la mensajería directa ya
no es una de ellas: se levanta desde el sobre del header, que está en las
cuatro pantallas raíz y se lleva el badge de no leídos que antes dibujaba la
nav. `/chat` y `/chat/:id` pasaron a ser pantallas empujadas (`PUSHED` en
`AppShell`), así que llevan flecha de regreso y esconden la barra.

Las dos flechas usan `backOr` (`src/lib/nav.ts`) y **no** un `push` al destino
de vuelta. Un `push` deja en el historial la pantalla que se está cerrando, y
con dos pantallas que se apuntan entre sí eso es un ciclo del que no se sale:
la conversación empuja la bandeja, la bandeja retrocede a la conversación. El
`fallback` —para la pantalla abierta en frío, donde no hay nada que desapilar—
va con `replace` por el mismo motivo.

`/foro` lista lo mismo que el feed (`getFeed()`: todo lo no oculto de cuentas
no suspendidas, del más nuevo al más viejo) con algo que el feed no tiene: un
`FloatingButton` que abre el `PostComposer` en un `BottomSheet`. Sin controles
de orden — la pantalla se lee de arriba abajo y nada más. El FAB se levanta por
encima de la barra con
`!bottom-[calc(var(--bottom-nav)+1rem)]`: `--bottom-nav` es el alto real que
publica `BottomNav` (`0px` en ≥`md`, donde no hay barra).

## Historia del club

`/historia` es la pantalla más larga de la app y la única puramente editorial.
Cuenta la trayectoria de **Trap N Export**, el club que le da nombre a la app
—el resto del contenido es de relleno e inventado— en siete secciones de
scroll, con una fila de chips arriba que salta a cada una:

| Sección | Qué es | Con qué |
|---|---|---|
| hero | escudo, títulos, socios, palmarés | degradé de marca + contador propio |
| trayectoria | 5 etapas (1998 → hoy), colapsables, con hitos tipados | `EraTimeline` |
| temporadas | las últimas cinco → `/historia/:año` | `MediaCard` en fila con snap |
| museo | 9 fotos del archivo | `Carousel` (`thumbs`, `zoomable`) |
| video | clips, con portada animada | `ClipRail` / `ClipCard` |
| frases | citas históricas | `QuoteBlock` |
| jugadores | elegir uno: números, skills, carrera, fotos, clips y su frase | `PlayerSpotlight` |

Es scroll y no `Tabs` a propósito: una trayectoria se lee de corrido. Los
jugadores tienen deep link —`/historia?jugador=vega`, que abre la ficha y baja
hasta ella—, y por eso `page.tsx` envuelve la pantalla en `<Suspense>`: sin
límite de suspenso, `useSearchParams()` rompe el prerender de la ruta.

Cuatro componentes propios, porque la librería no los tiene (cada archivo
explica arriba contra qué se comparó):

| Componente | Por qué no sale de la librería |
|---|---|
| `EraTimeline` | los cuatro timelines de la librería son planos o miran al futuro; ninguno colapsa por etapa ni tiene tipo de hito |
| `ClipCard` / `ClipRail` | hay `VideoPlayer`, pero no card de video: `MediaCard` es de imagen y `Carousel` no reproduce |
| `QuoteBlock` | no hay componente de cita; `CommentBox` es otra cosa |
| `PlayerSpotlight` | compone `ChipCarousel` + `Tabs` + `ActivityTimeline` + `Carousel` + `StatCard` con los tres de arriba |

Los jugadores **no** linkean a `/u/:handle`: son contenido editorial, no cuentas
de la red social, y esas rutas darían 404. El link correcto es a su ficha.

Y los OpenGraph de `/historia` y `/historia/:año` son las dos únicas rutas sin
el sufijo ` · ${APP_NAME}`: el club se llama igual que la app, y "Historia de
Trap N Export · Trap N Export" es el mismo nombre dos veces en el preview. Las
dos van por `generateMetadata` y no por un `metadata` constante, porque el
nombre del club se edita en el panel: un objeto estático lo congelaría en lo que
decía el día del build.

Las siete secciones se editan enteras desde `/admin/historia` —incluidas las
imágenes, que suben a Firebase Storage—. Ver "Capa de datos" arriba para las
colecciones y el fallback a la semilla.

## El panel: dashboard y los ABM

`/admin` arranca con los **usuarios registrados** —el número grande, en su
propia card— y una grilla de cuatro **accesos rápidos**, uno por sección de
contenido, cada uno con su contador ("3 en total · 1 en borrador") para saber si
hay algo pendiente sin entrar. Debajo quedan los dos paneles de siempre: lo que
viene del cronograma y los reportes sin resolver.

| Sección | Qué hace | Detalles que no son obvios |
|---|---|---|
| `/admin/noticias` | título, copete, cuerpo, autor, estado | una sola destacada por vez: marcar una apaga la anterior |
| `/admin/encuestas` | pregunta, opciones, única/múltiple, cierre | editar una encuesta abierta **conserva** los votos de las opciones cuyo texto no cambió (el match es por texto, no por posición); de "cerrada" no se vuelve |
| `/admin/invitaciones` | invitado, evento, mensaje, fecha, hora, lugar, plantilla | crear **es** generar el link; el `code` no cambia al editar (puede estar mandado) y revocar apaga la ruta pública sin borrar la fila |
| `/admin/cronograma` | nombre, descripción, fecha, hora, duración, lugar, tipo | dos vistas de lo mismo: calendario para ver qué se pisa, lista para editar. Tocar un día vacío abre el alta con esa fecha |
| `/admin/historia` | las siete secciones de `/historia`, en solapas: club, etapas, temporadas, jugadores, frases, museo, video | "Club" no es un ABM sino la única fila que existe, así que va como formulario abierto. El año de una temporada **es** su URL: cambiarlo mueve el documento. El id de un jugador sale del nombre la primera vez y después queda fijo, porque es el `?jugador=` compartible y el `playerId` del salón de cada temporada |

Los cinco comparten `src/app/admin/Dialogs.tsx` (`FormModal`, `ConfirmDialog`,
`EstadoPill`, `RowMenu`). No es una abstracción de CRUD —cada sección arma su
formulario— sino los envoltorios que, escritos cinco veces, se desincronizan.
`/admin/historia` suma los suyos en `historia/campos.tsx` (`ImageField`,
`ListaEditor`, `ParesEditor`) y `historia/medios.tsx` (fotos, clips y la frase
de cierre, que la ficha de un jugador y la página de una temporada comparten).

Alta y modificación son **la misma acción**: `saveX` sin `id` inserta, con `id`
actualiza. Los tipos de entrada viven en `types.ts` y no en `actions.ts` porque
un archivo `"use server"` sólo puede exportar funciones async.

### La invitación y su link

Cargar una invitación genera `/invitacion/:code`, con `code` = slug del título y
del invitado + cuatro caracteres al azar (legible para mandarlo por WhatsApp; el
sufijo evita adivinar el de otra persona cambiando el nombre en la barra). Esa
ruta vive **fuera** del grupo `(app)`: la abre gente sin cuenta desde un link, y
con el shell público traería `BottomNav`, splash e instalador. Va `noindex`.

`InvitationCard` (`src/components/organisms/InvitationCard.tsx`) se renderiza en
dos lugares con el mismo código: la ruta pública y la vista previa en vivo del
formulario. Por eso no lleva `"use client"` ni estado, y el club llega **por
prop** en vez de leerlo por su cuenta: la identidad del club sale de Firestore
con el Admin SDK, que sólo corre en el servidor, y de todo el documento acá se
usan dos campos.

### Límites de la librería que hay que conocer antes de tocar estas pantallas

Cuatro cosas se descubrieron corriéndolo y están comentadas en el código; sin
saberlas es fácil volver a caer:

- **`DataTable` reserva 56px fijos** para `rowActions`
  (`[selectable && "44px", ...columnas, rowActions && "56px"]`). Dos botones de
  texto ya se desbordan sobre la columna anterior y el último queda cortado. De
  ahí `RowMenu`: un `⋯` que abre un `Dropdown`, que es lo que entra en 56px.
  ⚠️ `/admin/usuarios`, `/admin/publicaciones` y `/admin/reportes` **siguen con
  botones de texto** y tienen el mismo desborde: quedaron sin tocar porque no
  eran parte del pedido.
- **`Dropdown` con `divider: true` descarta el ítem**: renderiza sólo la línea e
  ignora `label` y `onClick` del mismo objeto. El separador va como ítem propio
  (`{ label: "", divider: true }`) o la acción desaparece del menú — que es
  exactamente lo que pasó con "Borrar".
- **`Input` sin `label` renderiza `placeholder=""`**: es un input de etiqueta
  flotante y el placeholder solo no se muestra. Los campos van con `label`.
- **`Card variant="gradient"` es un tinte al 10%**
  (`from-primary/[0.10] … to-transparent`), pensado para texto oscuro. Para una
  card de marca con texto blanco, el degradé va explícito sobre las CSS vars.

Y una que no se pudo arreglar desde acá: el `<label>` de `DatePicker` y
`TimePicker` no está asociado a su control (no hay `for`, y el control es un
`<button>`), así que un lector de pantalla no lo anuncia. Los componentes no
aceptan `aria-label`, así que la corrección es de la librería.

## El escudo

El escudo es el único asset de marca real de la app: todo lo demás
(`src/lib/media.ts`) son placeholders generados hasta que haya storage.

```
public/escudo.svg              el escudo, en una caja de 1080
public/icons/*.png             los cuatro íconos de la PWA, generados de él
```

⚠️ `public/escudo.svg` es una **reconstrucción vectorial** del escudo del club,
no el archivo original: se dibujó a partir de la imagen de referencia. Es fiel a
32px y a 512px, escala sin pérdida y no depende de ninguna tipografía (las
letras de TRAP son formas, no `<text>`: un SVG servido como imagen no puede usar
la fuente que carga la página). Si aparece el original, se reemplaza ese archivo
y se corre `npm run icons`; nada más lo referencia por contenido.

Dónde sale, todo desde el mismo archivo:

| Dónde | Cómo llega |
|---|---|
| `SplashScreen` al abrir la app | prop `icon` en `AppShell.tsx` |
| hero de `/historia` | `CLUB.crest` |
| tarjeta de invitación (pública y la previa del panel) | prop `club` de `InvitationCard` |
| brand del `SideBar`/`Navbar` del panel | `AdminShell.tsx` |
| favicon | `metadata.icons` en `layout.tsx`, primero el SVG |
| ícono de la PWA instalada y el splash que dibuja Android | `public/icons/*.png` |

`scripts/generate-icons.mjs` **duplica la geometría** del SVG como polígonos:
rasteriza a mano y no puede parsear un SVG sin sumar una dependencia de render.
Si se toca el escudo hay que tocar los dos y correr `npm run icons`. Los cuatro
íconos son el escudo sobre el degradé de marca; el maskable lo dibuja más chico
porque Android recorta y sólo el 80% central está garantizado.

Dos cosas que el escudo NO hace, a propósito: no cambia de color en modo oscuro
(sus colores son literales, no tokens — el filete blanco es lo que lo separa de
cualquier fondo) y no se genera de `CLUB.name`. El generador que armaba un
blasón con las iniciales (`crestUrl`) se borró de `media.ts` cuando entró el
escudo real.

## PWA

- `public/manifest.json` — linkeado desde `metadata.manifest`, con
  `display: "standalone"`. Sin eso el navegador nunca dispara
  `beforeinstallprompt` y el instalador no aparece (no está roto: no sos
  elegible).
- `public/sw.js` — mínimo y sin caché a propósito: una capa de caché mal hecha
  en una red social muestra el feed de ayer.
- Para probar el UI del instalador sin depender de la elegibilidad real:
  `<PwaInstallPrompt … forcePlatform="ios" />`.

## Qué falta

El registro completo está en [`PLAN.md`](PLAN.md), por fases y con el porqué de
cada decisión. Queda **una sola cosa**:

- **Push notifications.** `web-push` y las claves VAPID están en el proyecto y
  `PushSubscriptionDoc` está escrito en el schema, pero no hay una sola línea de
  código: `public/sw.js` no tiene handler de `push` ni existe el flujo de
  suscripción.

Todo lo demás migró: no queda store en memoria, el dominio entero vive en
Firestore y cada escritura la firma quien tiene la sesión. Si este README dice lo
contrario en algún lado, el que vale es `PLAN.md`.

Lo que **no** está verificado es el comportamiento en un navegador: typecheck,
lint y build pasan, pero el flujo real todavía no se probó.
