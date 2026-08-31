// Service worker mínimo.
//
// Existe por dos motivos concretos, no por completitud:
//   1. `UpdatePrompt` necesita un SW registrado para detectar la versión nueva
//      y mandarle SKIP_WAITING al aceptar.
//   2. Chrome pide un SW con handler de `fetch` para considerar la app
//      instalable; sin eso `PwaInstallPrompt` nunca aparece en Android.
//
// No cachea nada a propósito: una capa de caché mal hecha en una red social
// muestra el feed de ayer. Cuando haga falta offline real, va acá.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", () => {
  // passthrough: la red manda. Requisito de instalabilidad, no una estrategia.
});
