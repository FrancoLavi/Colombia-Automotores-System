// Ilustraciones de línea, livianas y decorativas (aria-hidden). Paleta de la app:
// tinta #1b1f24, acento #1f4fd1, celeste #8fa9f0 / #dce5fa, verde #1e7a46 / #dcebdf, ámbar #c2410c / #fde7d3.

type Props = { className?: string };

/** Camioneta sobre la ruta, con sol. Para el login y el inicio. */
export function IlustracionAuto({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 260 140" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="206" cy="34" r="20" fill="#fde7d3" />
      <path d="M14 112 H246" stroke="#1b1f24" strokeOpacity=".25" strokeWidth="2" />
      <path d="M40 120 H74 M104 120 H138 M168 120 H202" stroke="#1b1f24" strokeOpacity=".18" strokeWidth="2" />
      <path d="M58 32 h22 M66 24 h28" stroke="#8fa9f0" strokeWidth="2.5" />
      <path
        d="M34 96 V80 Q36 72 46 70 L86 66 L106 46 Q110 42 118 42 L162 42 Q170 42 174 48 L186 66 L222 68 Q230 69 230 78 V96 Z"
        fill="#dce5fa"
        stroke="#1b1f24"
        strokeWidth="2.5"
      />
      <path d="M112 50 L130 50 L130 66 L98 66 Z" fill="#ffffff" stroke="#1b1f24" strokeWidth="2" />
      <path d="M136 50 L160 50 Q165 50 168 54 L176 66 L136 66 Z" fill="#ffffff" stroke="#1b1f24" strokeWidth="2" />
      <path d="M186 66 V96" stroke="#1b1f24" strokeOpacity=".35" strokeWidth="2" />
      <path d="M44 80 h10" stroke="#c2410c" strokeWidth="3" />
      <path d="M216 78 h8" stroke="#1f4fd1" strokeWidth="3" />
      <circle cx="78" cy="98" r="15" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="78" cy="98" r="5" fill="#1b1f24" />
      <circle cx="192" cy="98" r="15" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="192" cy="98" r="5" fill="#1b1f24" />
    </svg>
  );
}

/** Billetes y monedas. Para Caja. */
export function IlustracionCaja({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="22" y="40" width="96" height="54" rx="8" fill="#dcebdf" stroke="#1b1f24" strokeWidth="2.5" transform="rotate(-8 70 67)" />
      <rect x="34" y="46" width="96" height="54" rx="8" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="82" cy="73" r="12" stroke="#1e7a46" strokeWidth="2.5" />
      <path d="M82 66 v14 M78 69 h6 a3 3 0 0 1 0 6 h-4 a3 3 0 0 0 0 6 h6" stroke="#1e7a46" strokeWidth="2" />
      <ellipse cx="156" cy="96" rx="22" ry="7" fill="#fde7d3" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M134 96 v-8 M178 96 v-8" stroke="#1b1f24" strokeWidth="2.5" />
      <ellipse cx="156" cy="88" rx="22" ry="7" fill="#fde7d3" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M134 88 v-8 M178 88 v-8" stroke="#1b1f24" strokeWidth="2.5" />
      <ellipse cx="156" cy="80" rx="22" ry="7" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M150 28 l6 -8 l6 8 M156 20 v24" stroke="#8fa9f0" strokeWidth="2.5" />
    </svg>
  );
}

/** Edificio con autos y gráfico ascendente. Para Patrimonio. */
export function IlustracionPatrimonio({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 104 H210" stroke="#1b1f24" strokeOpacity=".25" strokeWidth="2" />
      <path d="M24 104 V52 L70 30 L116 52 V104" fill="#dce5fa" stroke="#1b1f24" strokeWidth="2.5" />
      <rect x="50" y="68" width="40" height="36" fill="#ffffff" stroke="#1b1f24" strokeWidth="2" />
      <path d="M50 80 h40 M50 92 h40" stroke="#1b1f24" strokeOpacity=".3" strokeWidth="2" />
      <path d="M134 98 v-24 a6 6 0 0 1 6 -6 h28 a6 6 0 0 1 6 6 v24 Z" fill="#fde7d3" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="144" cy="100" r="6" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="166" cy="100" r="6" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M140 46 L156 34 L170 40 L196 18" stroke="#1e7a46" strokeWidth="3" />
      <path d="M186 18 h10 v10" stroke="#1e7a46" strokeWidth="3" />
    </svg>
  );
}

/** Tablero con barras. Para Reportes. */
export function IlustracionReportes({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="20" y="16" width="150" height="92" rx="10" fill="#ffffff" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M20 34 H170" stroke="#1b1f24" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="32" cy="25" r="3" fill="#c2410c" />
      <circle cx="42" cy="25" r="3" fill="#8fa9f0" />
      <rect x="40" y="70" width="14" height="26" rx="3" fill="#dce5fa" stroke="#1f4fd1" strokeWidth="2" />
      <rect x="64" y="56" width="14" height="40" rx="3" fill="#dce5fa" stroke="#1f4fd1" strokeWidth="2" />
      <rect x="88" y="62" width="14" height="34" rx="3" fill="#dce5fa" stroke="#1f4fd1" strokeWidth="2" />
      <rect x="112" y="46" width="14" height="50" rx="3" fill="#1f4fd1" />
      <circle cx="160" cy="88" r="20" fill="#dcebdf" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M160 88 V68 A20 20 0 0 1 178 96 Z" fill="#1e7a46" />
    </svg>
  );
}

/** Estado vacío: cono y llave. */
export function IlustracionVacio({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 86 H148" stroke="#1b1f24" strokeOpacity=".25" strokeWidth="2" />
      <path d="M40 86 L54 28 h8 L76 86 Z" fill="#fde7d3" stroke="#1b1f24" strokeWidth="2.5" />
      <path d="M47 58 h22 M43 72 h30" stroke="#c2410c" strokeWidth="3" />
      <circle cx="112" cy="50" r="12" fill="#dce5fa" stroke="#1b1f24" strokeWidth="2.5" />
      <circle cx="112" cy="50" r="4" fill="#ffffff" stroke="#1b1f24" strokeWidth="2" />
      <path d="M121 58 L138 75 M130 67 l5 -5 M134 71 l5 -5" stroke="#1b1f24" strokeWidth="2.5" />
    </svg>
  );
}

/** Mensaje de pantalla vacía con ilustración. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-suave">
      <IlustracionVacio className="h-24 w-auto" />
      <div className="max-w-md text-sm">{children}</div>
    </div>
  );
}
