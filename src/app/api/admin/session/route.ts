import { NextResponse } from "next/server";

import { cerrarSesion, crearSesion, SinPermisoError } from "@/lib/auth/sesion";

/** Canje de un idToken de Firebase por la cookie de sesión, exigiendo el panel.
 *
 *  Es `/api/session` más una condición: la cuenta tiene que traer el custom
 *  claim `admin`. Todo lo demás —verificar el token, emitir la cookie firmada,
 *  revocar al salir— vive en `lib/auth/sesion.ts` y es exactamente el mismo
 *  código, porque la cookie **es la misma**: Firebase Hosting sólo deja pasar
 *  `__session`, así que no hay una para el feed y otra para el panel.
 *
 *  Entonces, ¿para qué existe esta ruta si la cookie es la misma? Para que la
 *  pantalla de login pueda decir "esa cuenta no tiene acceso" en el momento, en
 *  vez de dejar entrar y rebotar contra `requireAdmin()` una pantalla después.
 *  El corte de verdad sigue estando en la lectura: quien tenga una cookie sin
 *  el claim entra al proxy y muere ahí.
 */

/*  `firebase-admin` no corre en el runtime edge. Explícito y no por defecto: si
 *  alguien mueve esta ruta a edge, tiene que ver por qué no puede. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  let idToken: string | undefined;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: "Falta el token." }, { status: 400 });
  }

  try {
    await crearSesion(idToken, { exigirAdmin: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SinPermisoError) {
      // Deliberadamente parco: quien no es admin no tiene por qué enterarse de
      // qué le falta para entrar.
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "No pudimos validar tu sesión." }, { status: 401 });
  }
}

/** Cerrar sesión del panel.
 *
 *  Idéntico a `DELETE /api/session` —borra la cookie y revoca los refresh
 *  tokens— y se mantiene separado sólo para que `SalirDelPanel` no tenga que
 *  saber del módulo público.
 */
export async function DELETE() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
