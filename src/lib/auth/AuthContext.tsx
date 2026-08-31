"use client";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

import { touchLastSeen, watchAccount, type AccountVM } from "@/lib/auth/profile";
import { auth } from "@/lib/firebase/client";

/** Quién visita la app, del lado del cliente.
 *
 *  Son dos cosas y no una, y conviene no confundirlas:
 *
 *    - `user`    — la credencial de Firebase Auth. Dice que alguien inició
 *                  sesión y con qué email. No sabe cómo se llama ni qué puede
 *                  hacer.
 *    - `account` — su documento en `trapnexport-user`: nombre, handle, avatar,
 *                  rol y estado. Es lo que la UI muestra y con lo que decide.
 *
 *  `account` puede ser `null` con `user` presente: es una cuenta a medio crear
 *  (la credencial existe, el perfil no). No es lo mismo que no haber iniciado
 *  sesión, y las pantallas que gatean por identidad tienen que mirar `account`.
 *
 *  Sigue separado del `SessionVM` que inyecta el servidor (`lib/social/queries`),
 *  que es la cuenta semilla del feed mientras esa parte no se migre a Firestore.
 */
interface AuthState {
  user: FirebaseUser | null;
  account: AccountVM | null;
  /** `true` hasta que se resolvieron **las dos**: la credencial y el perfil.
   *  Cortar antes haría que la app se pinte un frame como si no hubiera nadie. */
  loading: boolean;
}

const AuthCtx = createContext<AuthState>({ user: null, account: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, account: null, loading: true });

  useEffect(() => {
    // La escucha del perfil se corta y se rearma con cada cambio de sesión: sin
    // esto, cerrar sesión dejaría corriendo un `onSnapshot` sobre un documento
    // que las reglas ya no dejan leer, y el siguiente login sumaría otro.
    let stopAccount: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopAccount?.();
      stopAccount = undefined;

      if (!user) {
        setState({ user: null, account: null, loading: false });
        return;
      }

      setState((prev) => ({ ...prev, user, loading: true }));
      stopAccount = watchAccount(user.uid, (account) =>
        setState({ user, account, loading: false }),
      );

      // Una sola vez por sesión, y FUERA del callback del snapshot: escribir
      // `lastSeenAt` modifica el documento que estamos escuchando, así que
      // hacerlo ahí adentro se llamaría a sí mismo para siempre.
      touchLastSeen(user.uid);
    });

    return () => {
      stopAccount?.();
      stopAuth();
    };
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
