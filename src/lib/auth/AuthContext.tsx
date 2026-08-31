"use client";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client";

/** Quién visita la app, del lado del cliente — separado de `SessionVM`
 *  (`lib/social/queries.ts`), que sigue siendo la cuenta semilla del feed
 *  mientras esa parte no se migra.
 *
 *  Esto es lo nuevo y sí es real: gatea specíficamente lo que ya pide
 *  identidad de verdad (login, registro, votar) sin tocar el resto del feed,
 *  que sigue viéndose "logueado" con la cuenta de demo hasta que se decida
 *  migrar `currentUserId` también. */
interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthCtx = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
