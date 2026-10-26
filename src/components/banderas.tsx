// Banderitas de ARS y USD, dibujadas a mano: los emoji de bandera (🇦🇷 🇺🇸) no se dibujan
// en Chrome ni Edge sobre Windows, que muestran las dos letras en su lugar.

type Props = { className?: string };

const BASE = "inline-block h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-black/15 align-[-2px]";

export function BanderaArs({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 14" className={`${BASE} ${className}`} aria-hidden="true">
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="20" height="4.67" fill="#74acdf" />
      <rect y="9.33" width="20" height="4.67" fill="#74acdf" />
      <circle cx="10" cy="7" r="1.6" fill="#f6b40e" stroke="#c2410c" strokeWidth=".3" />
    </svg>
  );
}

export function BanderaUsd({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 20 14" className={`${BASE} ${className}`} aria-hidden="true">
      <rect width="20" height="14" fill="#ffffff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y} width="20" height="1.08" fill="#b22234" />
      ))}
      <rect width="8.5" height="7.54" fill="#3c3b6e" />
      {[1.3, 3.1, 4.9, 6.7].map((x) =>
        [1.3, 3.1, 4.9, 6.7].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".42" fill="#ffffff" />),
      )}
    </svg>
  );
}

/** Banderita de la moneda. `texto` la acompaña con el código (ARS / USD). */
export function Bandera({ moneda, texto = false, className = "" }: { moneda: "ARS" | "USD"; texto?: boolean; className?: string }) {
  const bandera = moneda === "USD" ? <BanderaUsd className={className} /> : <BanderaArs className={className} />;
  if (!texto) return bandera;
  return (
    <span className="inline-flex items-center gap-1.5">
      {moneda}
      {bandera}
    </span>
  );
}
