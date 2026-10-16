import { ETIQUETA_ETAPA, ETIQUETA_ORIGEN, linkWhatsapp, type Etapa, type Origen } from "@/domain/contactos";

const COLOR_ETAPA: Record<Etapa, string> = {
  DATO: "bg-neutro-fondo text-neutro-texto",
  PREVENTA: "bg-info-fondo text-info-texto",
  CLIENTE: "bg-ok-fondo text-ok-texto",
  DESCARTADO: "bg-[#f3d6d6] text-[#7a1f1f]",
};

export function ChipEtapa({ etapa }: { etapa: Etapa }) {
  return <span className={`chip ${COLOR_ETAPA[etapa]}`}>{ETIQUETA_ETAPA[etapa]}</span>;
}

export function ChipOrigen({ origen }: { origen: Origen }) {
  return <span className="chip border border-borde bg-white text-neutro-texto">{ETIQUETA_ORIGEN[origen]}</span>;
}

/** Teléfono con acceso directo a WhatsApp. */
export function Telefono({ telefono }: { telefono: string | null }) {
  if (!telefono) return <span className="text-apagado">—</span>;
  const wa = linkWhatsapp(telefono);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a href={`tel:${telefono.replace(/[^\d+]/g, "")}`} className="num">
        {telefono}
      </a>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="chip bg-ok-fondo text-ok-texto no-underline">
          WhatsApp
        </a>
      )}
    </span>
  );
}
