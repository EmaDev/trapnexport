import { NextResponse, type NextRequest } from "next/server";

/** Guard del módulo privado (convención `proxy` de Next 16, ex `middleware`).
 *
 *  Dos cosas, y sólo para `/admin`:
 *
 *  1. `X-Robots-Tag: noindex` — el `metadata.robots` del layout ya lo declara,
 *     pero esto lo cubre también para respuestas que no son HTML (una acción,
 *     un JSON) y para crawlers que miran la cabecera antes que el `<head>`.
 *  2. Si `ADMIN_AUTH_ENABLED=true`, corta la request cuando no hay cookie de
 *     sesión, antes de renderizar nada. Mientras el flag esté apagado el panel
 *     queda abierto, que es lo pedido para esta etapa.
 *
 *  La verificación criptográfica de la cookie NO va acá: el proxy corre en el
 *  runtime edge y `firebase-admin` necesita Node. Acá se mira que exista; el
 *  token se valida en `requireAdmin()`, del lado del servidor.
 */

const SESSION_COOKIE = "__session";

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) return NextResponse.next();

  if (process.env.ADMIN_AUTH_ENABLED === "true") {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
