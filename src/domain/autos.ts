// Cómo se muestra y se busca un auto en todo el sistema: siempre desglosado en marca, modelo y
// patente (ej.: Ford · Ranger · AC456EF), cada uno con su filtro.

export interface DatosAuto {
  marca: string;
  modelo: string;
  dominio: string | null;
}

export interface FiltroAuto {
  marca?: string;
  modelo?: string;
  patente?: string;
}

/** Sin tildes, sin mayúsculas y sin espacios de más: "Citroën C4" = "citroen c4". */
export const textoPlano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Las patentes se comparan sin espacios ni guiones: "AC 456 EF" = "ac456ef". */
export const patentePlana = (s: string) => textoPlano(s).replace(/[\s.-]/g, "");

/** Lee el filtro de los parámetros de la URL (marca, modelo, patente). */
export function leerFiltroAuto(sp: Record<string, string | undefined>): FiltroAuto {
  const f: FiltroAuto = {};
  for (const k of ["marca", "modelo", "patente"] as const) if (sp[k]?.trim()) f[k] = sp[k]!.trim();
  return f;
}

export const hayFiltroAuto = (f: FiltroAuto) => Boolean(f.marca || f.modelo || f.patente);

/**
 * Si el auto coincide con el filtro. Cada campo busca "contiene", así "rang" encuentra la Ranger y
 * "456" la AC456EF. Lo que no tiene auto (un gasto del salón) solo pasa si no hay filtro de auto.
 */
export function coincideAuto(a: DatosAuto | null | undefined, f: FiltroAuto): boolean {
  if (!hayFiltroAuto(f)) return true;
  if (!a) return false;
  if (f.marca && !textoPlano(a.marca).includes(textoPlano(f.marca))) return false;
  if (f.modelo && !textoPlano(a.modelo).includes(textoPlano(f.modelo))) return false;
  if (f.patente && !patentePlana(a.dominio ?? "").includes(patentePlana(f.patente))) return false;
  return true;
}

/** Marcas y modelos distintos, ordenados, para sugerir en los filtros. */
export function opcionesAuto(autos: (DatosAuto | null | undefined)[]) {
  const marcas = new Set<string>();
  const modelos = new Set<string>();
  for (const a of autos) {
    if (!a) continue;
    marcas.add(a.marca);
    modelos.add(a.modelo);
  }
  const orden = (xs: Set<string>) => [...xs].sort((a, b) => a.localeCompare(b, "es"));
  return { marcas: orden(marcas), modelos: orden(modelos) };
}
