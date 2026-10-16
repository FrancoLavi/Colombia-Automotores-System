// Reglas de contactos, agenda y pedidos. Ver docs/MVP.md (S1, M2).

export type Etapa = "DATO" | "PREVENTA" | "CLIENTE" | "DESCARTADO";
export type Origen = "WHATSAPP" | "FACEBOOK" | "MARKETPLACE" | "INSTAGRAM" | "REFERIDO" | "SALON" | "OTRO";
export type TipoActividad = "LLAMADA" | "WHATSAPP" | "VISITA" | "OTRO";

export const ETIQUETA_ETAPA: Record<Etapa, string> = { DATO: "Dato", PREVENTA: "Preventa", CLIENTE: "Cliente", DESCARTADO: "Descartado" };
export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  MARKETPLACE: "Marketplace",
  INSTAGRAM: "Instagram",
  REFERIDO: "Referido",
  SALON: "Salón",
  OTRO: "Otro",
};
export const ETIQUETA_ACTIVIDAD: Record<TipoActividad, string> = { LLAMADA: "Llamada", WHATSAPP: "WhatsApp", VISITA: "Visita", OTRO: "Otro" };

/** Cambios de etapa manuales. PREVENTA y CLIENTE los pone el módulo de ventas. */
export function etapasManuales(e: Etapa): Etapa[] {
  if (e === "DATO") return ["DESCARTADO"];
  if (e === "DESCARTADO") return ["DATO"];
  return [];
}

/** Deja solo dígitos y saca el 0 / 15 / 54 de adelante para comparar duplicados: "+54 9 291 15-555-0142" → "2915550142". */
export function normalizarTelefono(t: string | null | undefined): string | null {
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // 291 15 5550142 → 291 5550142 (el 15 va después del código de área de 2 a 4 dígitos)
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  return d || null;
}

/** Link para abrir el chat de WhatsApp. */
export function linkWhatsapp(t: string | null | undefined): string | null {
  const n = normalizarTelefono(t);
  return n && n.length >= 10 ? `https://wa.me/549${n}` : null;
}

export interface PedidoCriterio {
  marca: string | null;
  modelo: string | null;
  anioDesde: number | null;
  anioHasta: number | null;
  presupuestoMax: number | null;
}

export interface AutoCriterio {
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  precio: number;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** HU-2.4: ¿el auto cumple lo que pide el cliente? Los campos vacíos del pedido no filtran. */
export function coincidePedido(p: PedidoCriterio, a: AutoCriterio): boolean {
  if (p.marca && sinAcentos(p.marca) !== sinAcentos(a.marca)) return false;
  if (p.modelo) {
    const texto = sinAcentos(`${a.modelo} ${a.version ?? ""}`);
    // Cada palabra del pedido tiene que aparecer: "amarok v6" coincide con "Amarok V6 Highline".
    if (!sinAcentos(p.modelo).split(/\s+/).every((w) => texto.includes(w))) return false;
  }
  if (p.anioDesde && a.anio < p.anioDesde) return false;
  if (p.anioHasta && a.anio > p.anioHasta) return false;
  if (p.presupuestoMax && a.precio > p.presupuestoMax) return false;
  return true;
}

/** Texto corto del pedido: "Volkswagen Amarok · 2017–2021 · hasta $ 30.000.000". */
export function describirPedido(p: PedidoCriterio): string {
  const partes = [[p.marca, p.modelo].filter(Boolean).join(" ") || "Cualquier auto"];
  if (p.anioDesde || p.anioHasta) partes.push(p.anioDesde && p.anioHasta ? `${p.anioDesde}–${p.anioHasta}` : p.anioDesde ? `desde ${p.anioDesde}` : `hasta ${p.anioHasta}`);
  if (p.presupuestoMax) partes.push(`hasta $ ${p.presupuestoMax.toLocaleString("es-AR")}`);
  return partes.join(" · ");
}
