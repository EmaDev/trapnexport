"use client";

import { onIdTokenChanged, type User as FirebaseUser } from "firebase/auth";
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
 *  **Además mantiene la cookie de sesión del servidor**, que es una tercera cosa
 *  y vive en otro lado: ver `sincronizarCookie` más abajo.
 */
interface AuthState {
  user: FirebaseUser | null;
  account: AccountVM | null;
  /** `true` hasta que se resolvieron **las tres**: la credencial, el perfil y la
   *  cookie de sesión del servidor.
   *
   *  Las dos primeras por lo de siempre: cortar antes pinta un frame como si no
   *  hubiera nadie. La tercera es nueva y es la que evita una carrera concreta:
   *  las pantallas de login navegan cuando esto baja, y a donde navegan es a un
   *  Server Component que lee la cookie. Si se van antes de que exista, el
   *  servidor arma la pantalla como si no hubiera sesión y nada la vuelve a
   *  pedir — hay que recargar a mano para verse adentro.
   *
   *  Casi no cuesta: el canje de la cookie y la primera lectura del perfil son
   *  dos requests que salen juntos, así que lo que se espera es el más lento de
   *  los dos y no la suma. */
  loading: boolean;
}

const AuthCtx = createContext<AuthState>({ user: null, account: null, loading: true });

/** Deja la cookie `__session` en sintonía con la credencial del navegador.
 *
 *  El servidor no ve el `idToken`: vive en JavaScript y dura una hora. Lo que ve
 *  es la cookie que `/api/session` emite a cambio de ese token
 *  (`lib/auth/sesion.ts`). Alguien tiene que canjearlo, y ese alguien es este
 *  provider y no las pantallas de login: hay **tres** puertas de entrada —email,
 *  registro y Google, más el retorno de `signInWithRedirect`, que ni siquiera
 *  pasa por una pantalla— y en cada una habría que acordarse. Acá es una sola.
 *
 *  Por eso el listener es `onIdTokenChanged` y no `onAuthStateChanged`: el
 *  segundo avisa cuando alguien entra o sale, el primero además cuando Firebase
 *  **rota el token**, cada hora. Esa rotación es justo el momento de renovar la
 *  cookie, y es lo que hace que una sesión de cinco días no se caiga sola.
 *
 *  Se canjea en cada emisión, incluida la primera de cada carga de página. Eso
 *  cuesta un request extra al abrir la app teniendo sesión. La alternativa
 *  —recordar en `localStorage` que ya se canjeó y saltearlo— ahorra ese request
 *  pero abre un desincronizado silencioso: si el navegador se queda sin la
 *  cookie y con el `localStorage` intacto, la persona se ve adentro y el
 *  servidor la ve afuera, y no hay forma de detectarlo desde acá porque la
 *  cookie es `httpOnly` y el cliente no puede leerla. Se prefiere el request.
 */
async function sincronizarCookie(user: FirebaseUser | null): Promise<void> {
  try {
    // Con tope: `loading` no baja hasta que esto termina, así que un request
    // colgado —red de celular a medias, túnel, avión— dejaría la app en el
    // splash para siempre. Ocho segundos y seguimos sin cookie: se ve el feed,
    // no se puede escribir, y el próximo giro del token vuelve a intentar.
    const signal = AbortSignal.timeout(8000);

    if (!user) {
      await fetch("/api/session", { method: "DELETE", signal });
      return;
    }
    const idToken = await user.getIdToken();
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal,
    });
  } catch {
    // Sin red no hay nada que hacer y no hay nada que decirle a nadie: la app
    // sigue funcionando en modo lectura, y las escrituras van a rebotar con
    // "iniciá sesión" hasta que vuelva la conexión y el token rote de nuevo.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, account: null, loading: true });

  useEffect(() => {
    // La escucha del perfil se corta y se rearma con cada cambio de sesión: sin
    // esto, cerrar sesión dejaría corriendo un `onSnapshot` sobre un documento
    // que las reglas ya no dejan leer, y el siguiente login sumaría otro.
    let stopAccount: (() => void) | undefined;

    const stopAuth = onIdTokenChanged(auth, (user) => {
      stopAccount?.();
      stopAccount = undefined;

      if (!user) {
        // Al salir no se espera el borrado: las pantallas que cierran sesión lo
        // piden ellas mismas y esperan la respuesta antes de navegar, porque
        // ahí el orden sí importa (ver `PerfilClient` y `SalirDelPanel`).
        void sincronizarCookie(null);
        setState({ user: null, account: null, loading: false });
        return;
      }

      setState((prev) => ({ ...prev, user, loading: true }));

      /*  Las dos mitades salen juntas y `loading` baja recién con la segunda.
       *  El perfil es una escucha viva: una vez destapado, cada snapshot nuevo
       *  tiene que pintar igual, así que `publicar` no puede volver a esperar
       *  a la cookie. */
      let cookieLista = false;
      let cuenta: AccountVM | null = null;
      let huboCuenta = false;

      const publicar = () => {
        if (cookieLista && huboCuenta) setState({ user, account: cuenta, loading: false });
      };

      void sincronizarCookie(user).then(() => {
        cookieLista = true;
        publicar();
      });

      stopAccount = watchAccount(user.uid, (account) => {
        cuenta = account;
        huboCuenta = true;
        publicar();
      });

      // FUERA del callback del snapshot: escribir `lastSeenAt` modifica el
      // documento que estamos escuchando, así que hacerlo ahí adentro se
      // llamaría a sí mismo para siempre.
      //
      // Con `onIdTokenChanged` esto corre al entrar y después una vez por hora,
      // cuando rota el token, en vez de una sola vez por sesión. Es más seguido
      // que antes y está bien: el campo se llama "última vez que abrió la app" y
      // alimenta la cuenta de activos del panel, así que una PWA abierta toda la
      // tarde debería seguir contando como activa.
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
