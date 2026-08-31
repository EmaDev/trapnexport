import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { APP_NAME, APP_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Layout raíz: `<html>`, `<body>` y la metadata base. Nada más.
 *
 *  A propósito no monta ningún chrome (ni header, ni nav, ni contenedor con
 *  ancho máximo): los dos módulos de la app tienen shells distintos y cada uno
 *  lo arma en SU layout —`(app)/layout.tsx` para la red social, `admin/layout.tsx`
 *  para el panel—. Un `<main>` acá se sumaría al de ellos.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    // El SVG va primero y sin `sizes`: los navegadores que soportan favicon
    // vectorial lo eligen y lo dibujan nítido en cualquier densidad. Los PNG
    // quedan como fallback y son los que usa el instalador de la PWA.
    icon: [
      { url: "/escudo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-app bg-surface text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
