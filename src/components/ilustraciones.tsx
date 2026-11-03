// Ilustraciones de línea, livianas y decorativas (aria-hidden).
// Usan los tokens de color de globals.css, así que acompañan al tema claro y al oscuro.

type Props = { className?: string };

/** Camioneta sobre la ruta, con sol. Para el login y el inicio. */
export function IlustracionAuto({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 260 140" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="206" cy="34" r="20" fill="var(--color-aviso-fondo)" />
      <path d="M14 112 H246" stroke="var(--color-tinta)" strokeOpacity=".25" strokeWidth="2" />
      <path d="M40 120 H74 M104 120 H138 M168 120 H202" stroke="var(--color-tinta)" strokeOpacity=".18" strokeWidth="2" />
      <path d="M58 32 h22 M66 24 h28" stroke="var(--color-celeste)" strokeWidth="2.5" />
      <path
        d="M34 96 V80 Q36 72 46 70 L86 66 L106 46 Q110 42 118 42 L162 42 Q170 42 174 48 L186 66 L222 68 Q230 69 230 78 V96 Z"
        fill="var(--color-info-fondo)"
        stroke="var(--color-tinta)"
        strokeWidth="2.5"
      />
      <path d="M112 50 L130 50 L130 66 L98 66 Z" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M136 50 L160 50 Q165 50 168 54 L176 66 L136 66 Z" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M186 66 V96" stroke="var(--color-tinta)" strokeOpacity=".35" strokeWidth="2" />
      <path d="M44 80 h10" stroke="var(--color-grafico-stock)" strokeWidth="3" />
      <path d="M216 78 h8" stroke="var(--color-acento)" strokeWidth="3" />
      <circle cx="78" cy="98" r="15" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="78" cy="98" r="5" fill="var(--color-tinta)" />
      <circle cx="192" cy="98" r="15" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="192" cy="98" r="5" fill="var(--color-tinta)" />
    </svg>
  );
}

/** Billetes y monedas. Para Caja. */
export function IlustracionCaja({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="22" y="40" width="96" height="54" rx="8" fill="var(--color-ok-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" transform="rotate(-8 70 67)" />
      <rect x="34" y="46" width="96" height="54" rx="8" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="82" cy="73" r="12" stroke="var(--color-ok)" strokeWidth="2.5" />
      <path d="M82 66 v14 M78 69 h6 a3 3 0 0 1 0 6 h-4 a3 3 0 0 0 0 6 h6" stroke="var(--color-ok)" strokeWidth="2" />
      <ellipse cx="156" cy="96" rx="22" ry="7" fill="var(--color-aviso-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M134 96 v-8 M178 96 v-8" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <ellipse cx="156" cy="88" rx="22" ry="7" fill="var(--color-aviso-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M134 88 v-8 M178 88 v-8" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <ellipse cx="156" cy="80" rx="22" ry="7" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M150 28 l6 -8 l6 8 M156 20 v24" stroke="var(--color-celeste)" strokeWidth="2.5" />
    </svg>
  );
}

/** Edificio con autos y gráfico ascendente. Para Patrimonio. */
export function IlustracionPatrimonio({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 104 H210" stroke="var(--color-tinta)" strokeOpacity=".25" strokeWidth="2" />
      <path d="M24 104 V52 L70 30 L116 52 V104" fill="var(--color-info-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <rect x="50" y="68" width="40" height="36" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M50 80 h40 M50 92 h40" stroke="var(--color-tinta)" strokeOpacity=".3" strokeWidth="2" />
      <path d="M134 98 v-24 a6 6 0 0 1 6 -6 h28 a6 6 0 0 1 6 6 v24 Z" fill="var(--color-aviso-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="144" cy="100" r="6" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="166" cy="100" r="6" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M140 46 L156 34 L170 40 L196 18" stroke="var(--color-ok)" strokeWidth="3" />
      <path d="M186 18 h10 v10" stroke="var(--color-ok)" strokeWidth="3" />
    </svg>
  );
}

/** Tablero con barras. Para Reportes. */
export function IlustracionReportes({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="20" y="16" width="150" height="92" rx="10" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M20 34 H170" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="32" cy="25" r="3" fill="var(--color-grafico-stock)" />
      <circle cx="42" cy="25" r="3" fill="var(--color-celeste)" />
      <rect x="40" y="70" width="14" height="26" rx="3" fill="var(--color-info-fondo)" stroke="var(--color-acento)" strokeWidth="2" />
      <rect x="64" y="56" width="14" height="40" rx="3" fill="var(--color-info-fondo)" stroke="var(--color-acento)" strokeWidth="2" />
      <rect x="88" y="62" width="14" height="34" rx="3" fill="var(--color-info-fondo)" stroke="var(--color-acento)" strokeWidth="2" />
      <rect x="112" y="46" width="14" height="50" rx="3" fill="var(--color-acento)" />
      <circle cx="160" cy="88" r="20" fill="var(--color-ok-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M160 88 V68 A20 20 0 0 1 178 96 Z" fill="var(--color-ok)" />
    </svg>
  );
}

/** Estado vacío: cono y llave. */
export function IlustracionVacio({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 86 H148" stroke="var(--color-tinta)" strokeOpacity=".25" strokeWidth="2" />
      <path d="M40 86 L54 28 h8 L76 86 Z" fill="var(--color-aviso-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <path d="M47 58 h22 M43 72 h30" stroke="var(--color-grafico-stock)" strokeWidth="3" />
      <circle cx="112" cy="50" r="12" fill="var(--color-info-fondo)" stroke="var(--color-tinta)" strokeWidth="2.5" />
      <circle cx="112" cy="50" r="4" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M121 58 L138 75 M130 67 l5 -5 M134 71 l5 -5" stroke="var(--color-tinta)" strokeWidth="2.5" />
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

// ---------- Reportes: un dibujo por pestaña, para saber de un vistazo qué mide cada una ----------

const T = { stroke: "var(--color-tinta)", strokeWidth: 2.5 } as const;

/** Una pila de monedas que se reparte entre el salón (edificio) y un inversor (persona). */
export function IlustracionGanancias({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 108 H190" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      {/* monedas al medio */}
      <ellipse cx="100" cy="96" rx="20" ry="6" fill="var(--color-aviso-fondo)" {...T} />
      <path d="M80 96 v-10 M120 96 v-10" {...T} />
      <ellipse cx="100" cy="86" rx="20" ry="6" fill="var(--color-aviso-fondo)" {...T} />
      <path d="M80 86 v-10 M120 86 v-10" {...T} />
      <ellipse cx="100" cy="76" rx="20" ry="6" fill="var(--color-aviso-fondo)" {...T} />
      <path d="M96 76 h8" stroke="var(--color-grafico-stock)" strokeWidth="3" />
      {/* flechas hacia cada lado */}
      <path d="M76 58 Q60 44 46 52 M50 46 l-4 6 6 3" stroke="var(--color-ok)" strokeWidth="2.5" />
      <path d="M124 58 Q140 44 154 52 M150 46 l4 6 -6 3" stroke="var(--color-acento)" strokeWidth="2.5" />
      {/* salón */}
      <path d="M14 66 l5 -12 h34 l5 12 Z" fill="var(--color-ok-fondo)" {...T} />
      <rect x="18" y="66" width="36" height="42" fill="var(--color-superficie)" {...T} />
      <rect x="30" y="86" width="12" height="22" fill="var(--color-ok-fondo)" stroke="var(--color-tinta)" strokeWidth="2" />
      {/* inversor */}
      <circle cx="166" cy="70" r="9" fill="var(--color-info-fondo)" {...T} />
      <path d="M148 108 v-8 a18 18 0 0 1 36 0 v8" fill="var(--color-info-fondo)" {...T} />
    </svg>
  );
}

/** Sobre con billetes: sueldos y retiros. */
export function IlustracionPersonas({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 108 H190" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      <rect x="48" y="30" width="62" height="34" rx="4" fill="var(--color-ok-fondo)" {...T} transform="rotate(-8 79 47)" />
      <circle cx="80" cy="46" r="7" stroke="var(--color-ok)" strokeWidth="2.5" />
      <rect x="40" y="52" width="86" height="54" rx="6" fill="var(--color-superficie)" {...T} />
      <path d="M40 58 L83 84 L126 58" {...T} />
      <circle cx="156" cy="56" r="11" fill="var(--color-info-fondo)" {...T} />
      <path d="M134 106 v-10 a22 22 0 0 1 44 0 v10" fill="var(--color-info-fondo)" {...T} />
    </svg>
  );
}

/** Etiqueta de precio colgando de la llave del auto. */
export function IlustracionVentas({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 108 H190" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      <circle cx="60" cy="48" r="20" fill="var(--color-info-fondo)" {...T} />
      <circle cx="60" cy="48" r="6" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M76 60 L112 96 M98 82 l8 -8 M106 90 l8 -8" {...T} />
      <path d="M120 22 h46 l12 14 -12 14 h-46 Z" fill="var(--color-ok-fondo)" {...T} />
      <circle cx="128" cy="36" r="3.5" fill="var(--color-superficie)" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M140 36 h22" stroke="var(--color-ok)" strokeWidth="3" />
      <path d="M128 36 Q104 36 80 30" stroke="var(--color-tinta)" strokeOpacity=".5" strokeWidth="2" />
    </svg>
  );
}

/** Auto que entra y auto que sale. */
export function IlustracionMovimientoAutos({ className = "" }: Props) {
  const auto = (x: number, color: string) => (
    <g transform={`translate(${x} 0)`}>
      <path d="M4 92 v-12 q1 -6 8 -7 l14 -2 l10 -12 q2 -3 7 -3 h18 q5 0 7 4 l7 11 l9 1 q5 1 5 7 v13 Z" fill={color} {...T} />
      <circle cx="22" cy="93" r="8" fill="var(--color-superficie)" {...T} />
      <circle cx="68" cy="93" r="8" fill="var(--color-superficie)" {...T} />
    </g>
  );
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 108 H190" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      {auto(4, "var(--color-ok-fondo)")}
      {auto(108, "var(--color-info-fondo)")}
      <path d="M20 30 h40 M50 22 l10 8 -10 8" stroke="var(--color-ok)" strokeWidth="3" />
      <path d="M180 30 h-40 M150 22 l-10 8 10 8" stroke="var(--color-acento)" strokeWidth="3" />
    </svg>
  );
}

/** Balanza: lo que entra contra lo que sale. */
export function IlustracionIngresosEgresos({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 108 H190" stroke="var(--color-tinta)" strokeOpacity=".2" strokeWidth="2" />
      <path d="M100 20 V100 M76 106 h48 M84 100 h32" {...T} />
      <path d="M40 36 H160" {...T} />
      <path d="M40 36 L24 72 h32 Z M160 36 L144 72 h32 Z" stroke="var(--color-tinta)" strokeWidth="2" />
      <path d="M22 72 a18 8 0 0 0 36 0 Z" fill="var(--color-ok-fondo)" {...T} />
      <path d="M142 72 a18 8 0 0 0 36 0 Z" fill="var(--color-aviso-fondo)" {...T} />
      <path d="M40 50 v14 M34 58 l6 6 6 -6" stroke="var(--color-ok)" strokeWidth="2.5" />
      <path d="M160 64 v-14 M154 56 l6 -6 6 6" stroke="var(--color-grafico-stock)" strokeWidth="2.5" />
      <circle cx="100" cy="20" r="5" fill="var(--color-acento)" />
    </svg>
  );
}
