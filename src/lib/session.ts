"use client";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase/client";

/** Sesión del lado del cliente — la costura por donde entra Firebase Auth.
 *
 *  `useSplash({ until })` espera esta promesa antes de destapar el feed: sin
 *  sesión resuelta se ven avatares vacíos y contadores en 0 durante el primer
 *  frame. Resuelve con la primera emisión de `onAuthStateChanged` — `null` si
 *  nadie inició sesión, el `FirebaseUser` si sí.
 *
 *  El feed en sí sigue mostrando la cuenta semilla (`SessionVM`, inyectada por
 *  el servidor): esto sólo destapa el splash, no cambia de quién se ve el
 *  feed. Ese es el próximo paso, no este.
 */
export const loadSession = (): Promise<unknown> =>
  new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
