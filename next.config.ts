import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /** El carrete del perfil manda fotos y videos como data-URI dentro de una
     *  Server Action (`addGalleryItem`), y el default de Next es 1 MB: un video
     *  de siete segundos ya da 413. El tope de acá tiene que quedar por encima
     *  de `MAX_VIDEO_BYTES` (`lib/media-upload.ts`) más el ~33% que agrega
     *  base64 — hoy 7 MB → ~9.3 MB. Si subís uno, subí el otro.
     *
     *  Desaparece el día que las subidas vayan a Firebase Storage desde el
     *  cliente: ahí por la action viaja una URL, no el archivo. */
    serverActions: { bodySizeLimit: "12mb" },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
