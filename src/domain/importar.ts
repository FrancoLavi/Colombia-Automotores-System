// Interpretación de la planilla de stock (hoja "GENERAL"): descripción libre → marca / modelo / versión.

const MODELOS: Record<string, string> = {
  // Volkswagen
  AMAROK: "Volkswagen", AMROK: "Volkswagen", GOL: "Volkswagen", POLO: "Volkswagen", VENTO: "Volkswagen", VOYAGE: "Volkswagen",
  UP: "Volkswagen", "HIGH UP": "Volkswagen", TAOS: "Volkswagen", "T-CROSS": "Volkswagen", NIVUS: "Volkswagen", SAVEIRO: "Volkswagen",
  SURAN: "Volkswagen", FOX: "Volkswagen", TIGUAN: "Volkswagen", VIRTUS: "Volkswagen", BORA: "Volkswagen", GOLF: "Volkswagen",
  // Ford
  KA: "Ford", FOCUS: "Ford", FIESTA: "Ford", ECOSPORT: "Ford", "ECO SPORT": "Ford", RANGER: "Ford", TERRITORY: "Ford", MONDEO: "Ford", KUGA: "Ford",
  // Renault
  CLIO: "Renault", LOGAN: "Renault", SANDERO: "Renault", KANGOO: "Renault", DUSTER: "Renault", "DUSTER OROCH": "Renault", OROCH: "Renault",
  KWID: "Renault", CAPTUR: "Renault", FLUENCE: "Renault", MEGANE: "Renault", ALASKAN: "Renault", SYMBOL: "Renault",
  // Peugeot / Citroën
  "206": "Peugeot", "207": "Peugeot", "208": "Peugeot", "2008": "Peugeot", "307": "Peugeot", "308": "Peugeot", "408": "Peugeot",
  "3008": "Peugeot", PARTNER: "Peugeot", C3: "Citroën", C4: "Citroën", BERLINGO: "Citroën",
  // Fiat
  PALIO: "Fiat", SIENA: "Fiat", FIORINO: "Fiat", TORO: "Fiat", CRONOS: "Fiat", ARGO: "Fiat", MOBI: "Fiat", UNO: "Fiat", STRADA: "Fiat", PULSE: "Fiat",
  // Chevrolet
  CRUZE: "Chevrolet", ONIX: "Chevrolet", PRISMA: "Chevrolet", CORSA: "Chevrolet", CLASSIC: "Chevrolet", TRACKER: "Chevrolet", S10: "Chevrolet", AGILE: "Chevrolet",
  // Toyota
  COROLLA: "Toyota", HILUX: "Toyota", ETIOS: "Toyota", YARIS: "Toyota", SW4: "Toyota",
  // Otros
  TIGGO: "Chery", "HR-V": "Honda", CITY: "Honda", CIVIC: "Honda", FIT: "Honda", KICKS: "Nissan", FRONTIER: "Nissan", VERSA: "Nissan",
};

const MARCAS = ["VOLKSWAGEN", "VW", "FORD", "RENAULT", "PEUGEOT", "CITROEN", "CITROËN", "FIAT", "CHEVROLET", "TOYOTA", "CHERY", "HONDA", "NISSAN", "JEEP"];
const NOMBRE_MARCA: Record<string, string> = { VW: "Volkswagen", CITROEN: "Citroën", "CITROËN": "Citroën" };

const titulo = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** "AMAROK HIGHLINE 4X4 AT" → { marca: "Volkswagen", modelo: "Amarok", version: "HIGHLINE 4X4 AT" } */
export function interpretarDescripcion(desc: string): { marca: string | null; modelo: string; version: string | null } {
  let palabras = desc.replace(/\s+/g, " ").trim().toUpperCase().split(" ").filter(Boolean);
  let marca: string | null = null;
  if (palabras.length && MARCAS.includes(palabras[0])) {
    marca = NOMBRE_MARCA[palabras[0]] ?? titulo(palabras[0]);
    palabras = palabras.slice(1);
  }
  // Primero se prueba con dos palabras ("HIGH UP", "ECO SPORT", "DUSTER OROCH"), después con una.
  for (const n of [2, 1]) {
    const clave = palabras.slice(0, n).join(" ");
    if (palabras.length >= n && MODELOS[clave]) {
      const version = palabras.slice(n).join(" ") || null;
      const modelo = clave === "AMROK" ? "Amarok" : clave.split(" ").map(titulo).join(" ");
      return { marca: marca ?? MODELOS[clave], modelo, version };
    }
  }
  return { marca, modelo: palabras[0] ? titulo(palabras[0]) : "", version: palabras.slice(1).join(" ") || null };
}

/** "$16.500.000", "  $ 1.234,50", 16500000 → número. Vacío → null. */
export function interpretarImporte(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const limpio = String(v).replace(/[^\d,.-]/g, "");
  if (!limpio) return null;
  // Formato argentino: punto de miles, coma decimal.
  const n = Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Normaliza una patente: "ab 123 cd" → "AB123CD". */
export function normalizarDominio(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s || null;
}
