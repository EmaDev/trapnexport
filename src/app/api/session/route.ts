import { NextResponse } from "next/server";

import { cerrarSesion, crearSesion } from "@/lib/auth/sesion";

/** Canje de la sesión de la app.
 *
 *  El equivalente público de `/api/admin/session`, y la diferencia entre los dos
 *  es una sola línea: aquél exige el custom claim `admin` antes de emitir, éste
 *  no. Cualquier cuenta con sesión válida tiene derecho a su cookie, porque la
 *  necesita para votar, publicar y escribir. El claim decide quién entra al
 *  panel, no quién existe.
 *
 *  No lo llama ninguna pantalla: lo llama `AuthProvider` cada vez que Firebase
 *  emite o renueva un token. Ver `lib/auth/AuthContext.tsx` — centralizarlo ahí
 *  es lo que evita tener que acordarse de canjear en cada una de las tres
 *  puertas de entrada (email, registro y Google).
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
    await crearSesion(idToken);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos validar tu sesión." }, { status: 401 });
  }
}

/** Cerrar sesión: borra la cookie y revoca los refresh tokens de la cuenta.
 *
 *  Lo llama `AuthProvider` al detectar que ya no hay usuario, y también las
 *  pantallas que cierran sesión a mano antes de navegar — ahí el orden importa
 *  y por eso no alcanza con el listener: ver `PerfilClient`.
 */
export async function DELETE() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
