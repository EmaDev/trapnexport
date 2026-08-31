import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE } from "@/lib/admin/auth";
import { adminApp } from "@/lib/firebase/admin";

/** Canje de un idToken de Firebase por la cookie de sesión del panel.
 *
 *  Existe porque el token que tiene el navegador dura una hora y vive en
 *  JavaScript, y el servidor necesita algo que pueda leer en cada request y que
 *  el JavaScript de la página no pueda tocar. Eso es esta cookie: `httpOnly`,
 *  `sameSite: strict` y firmada por Firebase.
 *
 *  **Acá se decide quién es admin.** Es el único lugar donde se mira el custom
 *  claim antes de emitir credenciales, así que el orden importa: primero se
 *  verifica el token, después el claim, y sólo entonces se crea la cookie. Sin
 *  ese chequeo, cualquier persona registrada en la app pediría una cookie de
 *  admin con su propio token y entraría al panel.
 */

/*  `firebase-admin` no corre en el runtime edge. Explícito y no por defecto:
 *  si alguien mueve esta ruta a edge, tiene que ver por qué no puede. */
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

  const auth = getAuth(adminApp());

  try {
    // `true`: rechaza el token si la cuenta fue deshabilitada o su sesión
    // revocada desde que se emitió.
    const decoded = await auth.verifyIdToken(idToken, true);

    if (decoded.admin !== true) {
      // Deliberadamente igual que "no sos vos": quien no es admin no tiene por
      // qué enterarse de si el panel existe ni de qué le falta para entrar.
      return NextResponse.json(
        { error: "Esa cuenta no tiene acceso al panel." },
        { status: 403 },
      );
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: ADMIN_SESSION_MAX_AGE * 1000,
    });

    (await cookies()).set(ADMIN_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      // El JavaScript de la página nunca la lee; en producción sólo viaja por
      // HTTPS. En dev queda sin `secure` porque si no el navegador la descarta
      // en `http://localhost` y no se puede probar el flujo.
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos validar tu sesión." }, { status: 401 });
  }
}

/** Cerrar sesión del panel.
 *
 *  Borra la cookie **y** revoca los refresh tokens de la cuenta. Lo segundo es
 *  lo que hace que salir signifique algo: sin eso, una copia de la cookie
 *  robada antes de salir seguiría sirviendo hasta que expire, y el
 *  `verifySessionCookie(..., true)` de `requireAdmin` no tendría nada que
 *  detectar.
 */
export async function DELETE() {
  const jar = await cookies();
  const session = jar.get(ADMIN_SESSION_COOKIE)?.value;

  if (session) {
    try {
      const auth = getAuth(adminApp());
      const decoded = await auth.verifySessionCookie(session);
      await auth.revokeRefreshTokens(decoded.sub);
    } catch {
      // La cookie ya no valía. Igual hay que borrarla del navegador.
    }
  }

  jar.delete(ADMIN_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
