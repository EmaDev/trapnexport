import { NextResponse, type NextRequest } from "next/server";

/** Guard del módulo privado (convención `proxy` de Next 16, ex `middleware`).
 *
 *  Dos cosas, y sólo para `/admin`:
 *
 *  1. `X-Robots-Tag: noindex` — el `metadata.robots` del layout ya lo declara,
 *     pero esto lo cubre también para respuestas que no son HTML (una acción,
 *     un JSON) y para crawlers que miran la cabecera antes que el `<head>`.
 *  2. Sin cookie de sesión, redirige a `/admin/login` antes de renderizar nada.
 *
 *  **Esto no es la autenticación**, es un atajo. Acá sólo se mira que la cookie
 *  *exista*: el proxy corre en el runtime edge y `firebase-admin` necesita
 *  Node, así que verificar la firma es imposible en este punto. Una cookie
 *  `__session=cualquier-cosa` pasa por acá y muere en `requireAdmin()`, que es
 *  donde se valida de verdad. El valor de tenerlo igual es que el 99% de las
 *  visitas sin sesión se van sin ejecutar una sola query.
 *
 *  Por eso mismo ninguna página del panel puede confiar en esto: cada una llama
 *  a `requireAdmin()`, y cada Server Action también — una action es un POST que
 *  se puede invocar sin pasar por ninguna pantalla.
 */

const SESSION_COOKIE = "__session";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response =
    pathname.startsWith("/admin/login") || request.cookies.get(SESSION_COOKIE)?.value
      ? NextResponse.next()
      : redirigirAlLogin(request);

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function redirigirAlLogin(request: NextRequest) {
  const login = new URL("/admin/login", request.url);
  // A dónde volver después de entrar. Sin esto, quien llega a una solicitud
  // concreta por un link termina en el tablero y tiene que buscarla de nuevo.
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
