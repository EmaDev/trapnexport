import type { SVGProps } from "react";

/** Íconos de la app.
 *
 *  La librería no exporta un set de íconos: cada componente los recibe como
 *  `ReactNode`. Estos son SVG planos de 24×24 con `currentColor` y sin estado,
 *  así que sirven igual en un Server Component que dentro del shell cliente.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1.5em"
      height="1.5em"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── navegación pública ──────────────────────────────────────────────────── */

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-4.1A7.5 7.5 0 1 1 20 12Z" />
  </Icon>
);

/** Dos globos de diálogo encimados: el foro, la pantalla de posteos de la
 *  comunidad. Se distingue del `ChatIcon` —un globo solo, la mensajería
 *  directa— justamente por el segundo globo: uno es una conversación, el otro
 *  es "muchos hablando". Los dos conviven en pantalla (el foro en el tab, los
 *  mensajes en el header), así que tienen que leerse distinto de un vistazo. */
export const ForumIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 15.5H6l-2.5 2.2V8.2a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v5.3a2 2 0 0 1-2 2Z" />
    <path d="M8.5 6.2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-.5" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 3.3.8 5.1 1.6 6.2.4.5 0 1.3-.7 1.3H5.1c-.7 0-1.1-.8-.7-1.3C5.2 14.1 6 12.3 6 9Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
);

export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5.5H4.5V7A3.5 3.5 0 0 0 8 10.5" />
    <path d="M17 5.5h2.5V7a3.5 3.5 0 0 1-3.5 3.5" />
    <path d="M12 14v3.5M8.5 20.5h7" />
    <path d="M9.5 17.5h5l.7 3h-6.4l.7-3Z" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12 20 4l-8 16-2-6-6-2Z" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5 8 12l7 7" />
  </Icon>
);

/** Apunta a la derecha. Es la misma flecha que `BackIcon` espejada, y así se
 *  usa: girada 90° con `rotate-90` marca "esto se despliega". */
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

/* ── admin ───────────────────────────────────────────────────────────────── */

export const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
    <rect x="13.5" y="11" width="7" height="9.5" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a6 6 0 0 1 12 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.4a5.5 5.5 0 0 1 3 5.1" />
  </Icon>
);

export const PostsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
  </Icon>
);

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 21V4" />
    <path d="M6 4.5h11l-2 3.5 2 3.5H6" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4.5 20 19.5" />
    <path d="M9.6 6a9.6 9.6 0 0 1 2.4-.3c6 0 9.5 6.3 9.5 6.3a15 15 0 0 1-3 3.6" />
    <path d="M6.4 8a15.6 15.6 0 0 0-3.4 4.1S6.5 18.3 12 18.3a9 9 0 0 0 3.2-.6" />
    <path d="M10.2 10.3a2.7 2.7 0 0 0 3.6 3.7" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 6.5V4.8h5v1.7" />
    <path d="M6.5 6.5 7.4 20h9.2l.9-13.5" />
    <path d="M10.5 10v6M13.5 10v6" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2 19 6v5.4c0 4.2-2.8 7.4-7 9.4-4.2-2-7-5.2-7-9.4V6l7-2.8Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

/* ── historia del club ───────────────────────────────────────────────────── */

/** Pelota. Es el ícono "de fútbol" por defecto: partidos, goles, hitos. */
export const BallIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4L12 7.5Z" />
    <path d="M12 3.2v4.3M20.6 9.8l-5.2.2M17.6 19.6l-3.5-3.6M6.4 19.6l3.5-3.6M3.4 9.8l5.2.2" />
  </Icon>
);

/** Camiseta. Marca todo lo que es plantel: jugadores, dorsales, fichajes. */
export const ShirtIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3.5 5 5.5 3.5 10l2.5.9V20h12v-9.1l2.5-.9L19 5.5l-4-2" />
    <path d="M9 3.5a3 3 0 0 0 6 0" />
  </Icon>
);

/** Comilla de apertura, para las frases célebres. A diferencia del resto,
 *  va rellena: una comilla dibujada con `stroke` se lee como dos gotas. */
export const QuoteIcon = (p: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    width="1.5em"
    height="1.5em"
    {...p}
  >
    <path d="M9.6 5C6.2 6.6 4 9.7 4 13.4 4 16.5 5.8 19 8.5 19c2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.3-3.1-3.3-.4 0-.8 0-1.1.2.3-1.9 1.6-3.6 3.4-4.7L9.6 5Zm9 0c-3.4 1.6-5.6 4.7-5.6 8.4 0 3.1 1.8 5.6 4.5 5.6 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.3-3.1-3.3-.4 0-.8 0-1.1.2.3-1.9 1.6-3.6 3.4-4.7L18.6 5Z" />
  </svg>
);

/** Triángulo de play, relleno por el mismo motivo que la comilla. */
export const PlayIcon = (p: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    width="1.5em"
    height="1.5em"
    {...p}
  >
    <path d="M8 4.8v14.4a1 1 0 0 0 1.5.87l11.2-7.2a1 1 0 0 0 0-1.74L9.5 3.93A1 1 0 0 0 8 4.8Z" />
  </svg>
);

/** Estrella rellena: títulos y jugadores del salón. */
export const StarIcon = (p: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    width="1.5em"
    height="1.5em"
    {...p}
  >
    <path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8l-5.4 2.9 1.2-6.1L3.3 9.4l6.1-.8L12 3Z" />
  </svg>
);

/** Corazón, para los hitos en memoria de alguien. */
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20.5S3.5 15.4 3.5 9.4A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.5 2.1c0 6-8.5 11.1-8.5 11.1Z" />
  </Icon>
);

/** Flechas de tendencia: ascenso y descenso en la línea de tiempo del club. */
export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20V4" />
    <path d="m5.5 10.5 6.5-6.5 6.5 6.5" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v16" />
    <path d="m5.5 13.5 6.5 6.5 6.5-6.5" />
  </Icon>
);

/* ── contenido del panel ─────────────────────────────────────────────────── */

/** Noticias: una hoja con líneas de texto y un recuadro de foto. */
export const NewsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5h16v13H4z" />
    <path d="M7 9h5v4H7z" />
    <path d="M14.5 9h3M14.5 12h3M7 15.5h10" />
  </Icon>
);

/** Encuestas: tres barras de resultados de distinto largo. */
export const PollIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h13M4.5 12h9M4.5 17h5" />
  </Icon>
);

/** Invitaciones: un ticket con el troquelado al medio. */
export const TicketIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2 2 2 0 0 0 0 4v3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" />
    <path d="M13 6.5v11" strokeDasharray="2 2.5" />
  </Icon>
);

/** Cronograma: la hoja de calendario con el día marcado. */
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16v13H4z" />
    <path d="M4 10.5h16M8.5 4v4M15.5 4v4" />
    <path d="M7.5 14h3v3h-3z" />
  </Icon>
);

/* ── presentación ────────────────────────────────────────────────────────── */

/** Presentación: la pantalla de proyección sobre su trípode. */
export const PresentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 4.5h17v11h-17z" />
    <path d="M12 15.5v4M8.5 19.5h7" />
  </Icon>
);

/** Sonido activo. */
export const SoundOnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
  </Icon>
);

/** Sonido silenciado. */
export const SoundOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
  </Icon>
);

/** Entrar a pantalla completa: cuatro esquinas hacia afuera. */
export const FullscreenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);

/** Salir de pantalla completa: las mismas cuatro esquinas hacia adentro. */
export const FullscreenExitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Icon>
);

/* ── compartir la invitación ─────────────────────────────────────────────── */

/** El glifo oficial de WhatsApp: una silueta llena, no un trazo.
 *
 *  Rompe a propósito el trazo de 1.8 del resto del set —`Icon` spreadea las
 *  props después de sus defaults, así que `fill`/`stroke` acá los pisan—. Los
 *  logos de plataforma se reconocen por su forma exacta: redibujar el de
 *  WhatsApp "en el estilo de la app" da un ícono que el invitado no identifica
 *  de un vistazo, que es lo único que tiene que hacer un botón de compartir. */
export const WhatsAppIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01Zm-7.01 15.24h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.47-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
  </Icon>
);

/** Instagram, sí en el trazo del set: el logo es un cuadrado redondeado con un
 *  círculo y un punto, y esa forma sobrevive al cambio de relleno a línea. */
export const InstagramIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5.4" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15.5V3.5" />
    <path d="m8 7.5 4-4 4 4" />
    <path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v12" />
    <path d="m8 11.5 4 4 4-4" />
    <path d="M5 15.5v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Icon>
);

/** El destello del efecto holográfico: rotula el botón que pide permiso al
 *  giroscopio en iOS y el cartel de "movela" del primer segundo. */
export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 3v3" />
    <path d="M20 4.5h-3" />
  </Icon>
);

/* ── perfil ──────────────────────────────────────────────────────────────── */

/** Cámara. Rotula el botón que cambia la foto de perfil. */
export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5A2 2 0 0 1 5 6.5h2.2l1.4-2h6.8l1.4 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

/** Foto (montaña + sol dentro de un marco). Es el "adjuntar imagen". */
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m3.5 16.5 4.6-4.2 3.6 3.2 3-2.6 5.8 5.1" />
  </Icon>
);

/** Claqueta de video. Es el "adjuntar video" y el badge de los clips del carrete. */
export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="12.5" height="12" rx="2" />
    <path d="m15.5 10.5 5-2.5v8l-5-2.5Z" />
  </Icon>
);

/** Lápiz. Abre el panel de edición de la ficha. */
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6 3 3" />
  </Icon>
);

/** Botín / pierna hábil. Un pie de perfil con la línea del taco. */
export const BootIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5h4l.7 5.2 6.2 2.3A4 4 0 0 1 17.5 17v1.5H4Z" />
    <path d="M4 15.5h13" />
  </Icon>
);

/** Balanza. Marca el peso en la ficha. */
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5v15" />
    <path d="M6.5 19.5h11" />
    <path d="M4 8.5h16" />
    <path d="M4 8.5 1.8 14h4.4L4 8.5Z" />
    <path d="M20 8.5 17.8 14h4.4L20 8.5Z" />
  </Icon>
);

/** Torta / cumpleaños. Marca la edad en la ficha. */
export const CakeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20.5h16v-5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
    <path d="M4 17h16" />
    <path d="M12 13.5v-3" />
    <path d="M12 7.5a1.4 1.4 0 1 1-1.4-1.4c0-.8 1.4-2.6 1.4-2.6s1.4 1.8 1.4 2.6A1.4 1.4 0 0 1 12 7.5Z" />
  </Icon>
);

/** Regla vertical. Marca la altura en la ficha. */
export const RulerIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8" y="3" width="8" height="18" rx="1.5" />
    <path d="M8 7h3M8 11h4M8 15h3M8 19h4" />
  </Icon>
);

/** Pin de mapa. Marca la ciudad en la ficha. */
export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.5" />
  </Icon>
);

/** Signo de pregunta en un círculo. Abre la ayuda de "cómo instalar la app".
 *  Va relleno el punto porque un punto dibujado con `stroke` a este tamaño se
 *  ve como un anillo y no como un punto. */
export const HelpIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.4a2.7 2.7 0 1 1 3.5 2.6c-.6.2-.9.7-.9 1.3v.6" />
    <path d="M12 16.8h.01" strokeWidth={2.4} />
  </Icon>
);

/** Cuadrado con una flecha saliendo: el "compartir" de iOS, el que hay que
 *  tocar para llegar a "Añadir a pantalla de inicio". Se dibuja acá y no se
 *  reusa `ShareIcon` porque ese es el de tres nodos (Android) y la instrucción
 *  tiene que mostrar el ícono que la persona ve en su teléfono. */
export const IosShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11" />
    <path d="m8.5 7 3.5-3.5L15.5 7" />
    <path d="M7 11H5.8A1.8 1.8 0 0 0 4 12.8v6.4A1.8 1.8 0 0 0 5.8 21h12.4a1.8 1.8 0 0 0 1.8-1.8v-6.4A1.8 1.8 0 0 0 18.2 11H17" />
  </Icon>
);

/** Los tres puntos verticales del menú de Chrome en Android. Mismo criterio
 *  que `IosShareIcon`: la instrucción muestra el ícono real del navegador. */
export const DotsVerticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.5h.01" strokeWidth={2.4} />
    <path d="M12 12h.01" strokeWidth={2.4} />
    <path d="M12 18.5h.01" strokeWidth={2.4} />
  </Icon>
);
