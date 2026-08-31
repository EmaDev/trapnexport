"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/** Costura de Firebase del lado del cliente — auth y Firestore; Storage cuando
 *  haga falta.
 *
 *  `getApps()[0] ??` y no un módulo con guard manual: en `next dev`, HMR puede
 *  re-evaluar este archivo sin recargar la página, y `initializeApp` tira si
 *  se llama dos veces para la misma app por defecto.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/** Firestore, desde el navegador.
 *
 *  El alta de una cuenta se escribe desde acá y no desde una server action: la
 *  transacción que reserva el handle necesita ir firmada por el usuario para
 *  que las reglas de `firestore.rules` puedan validarla. Una server action
 *  recibiría el `uid` como un dato más del cliente y tendría que creerle.
 */
export const db = getFirestore(firebaseApp);
