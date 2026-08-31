"use client";

import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { authErrorMessage } from "@/lib/auth/errors";
import { auth, db } from "@/lib/firebase/client";
import { COL } from "@/lib/firebase/collections";

/** Entrar con Google.
 *
 *  Google da email, nombre y foto — no da handle, y el handle es obligatorio:
 *  es la URL del perfil y lo que se escribe para mencionar a alguien. Por eso
 *  esto **no termina el alta**: devuelve si falta perfil, y quien llama manda a
 *  `/completar-perfil`.
 *
 *  Sirve para entrar y para registrarse, sin distinguir: es el mismo botón en
 *  las dos pantallas. Google ya sabe si la cuenta existe; preguntárselo a la
 *  persona sería pedirle un dato que el sistema tiene.
 */

const provider = new GoogleAuthProvider();

/*  Sin esto, Google entra directo con la única sesión abierta del navegador y
 *  no hay forma de elegir otra cuenta — que es justo lo que hace falta en un
 *  teléfono compartido, o cuando alguien tiene la del trabajo abierta. */
provider.setCustomParameters({ prompt: "select_account" });

export type GoogleOutcome =
  /** hay sesión; `needsProfile` dice si falta escribir el perfil */
  | { status: "listo"; needsProfile: boolean }
  /** se fue a la pantalla de Google; al volver entra por `onAuthStateChanged` */
  | { status: "redirigiendo" }
  /** cerró el popup — no es un error que haya que mostrar */
  | { status: "cancelado" }
  | { status: "error"; error: string };

/** Los códigos en los que el popup no es viable, y hay que ir por redirect.
 *
 *  No son fallas: es un navegador que bloquea ventanas emergentes, o una PWA
 *  instalada donde `window.open` no abre nada. Sin este fallback, entrar con
 *  Google desde la app instalada en iOS simplemente no funciona, y desde
 *  afuera se ve como un botón que no hace nada. */
const SIN_POPUP = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/** Cerrar el popup a mano no es un error: no hay nada que decirle a alguien
 *  que acaba de decidir que no. */
const CANCELADO = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

const tienePerfil = async (uid: string) => (await getDoc(doc(db, COL.user, uid))).exists();

export async function signInWithGoogle(): Promise<GoogleOutcome> {
  try {
    const cred = await signInWithPopup(auth, provider);
    return { status: "listo", needsProfile: !(await tienePerfil(cred.user.uid)) };
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code ?? "";

    if (CANCELADO.has(code)) return { status: "cancelado" };

    if (SIN_POPUP.has(code)) {
      try {
        await signInWithRedirect(auth, provider);
        return { status: "redirigiendo" };
      } catch (err2) {
        return { status: "error", error: authErrorMessage(err2) };
      }
    }

    return { status: "error", error: authErrorMessage(err) };
  }
}
