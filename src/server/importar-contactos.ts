import "server-only";
import ExcelJS from "exceljs";
import { normalizarTelefono, type Origen } from "@/domain/contactos";
import { ErrorNegocio } from "./errores";
import { buscarPorTelefono, type FilaContacto } from "./contactos";

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const COLUMNAS = {
  nombreCompleto: ["NOMBRE Y APELLIDO", "APELLIDO Y NOMBRE", "CLIENTE", "CONTACTO"],
  nombre: ["NOMBRE"],
  apellido: ["APELLIDO"],
  telefono: ["TELEFONO", "CELULAR", "TEL", "WHATSAPP", "CEL"],
  email: ["MAIL", "EMAIL", "E-MAIL", "CORREO"],
  localidad: ["LOCALIDAD", "CIUDAD"],
  origen: ["ORIGEN", "COMO LLEGO", "VINO POR", "CANAL"],
  productoInteres: ["INTERES", "BUSCA", "PRODUCTO", "QUE BUSCA", "CONSULTA"],
  usadoAEntregar: ["USADO", "USADO A ENTREGAR", "ENTREGA"],
  observaciones: ["OBSERVACIONES", "NOTAS", "COMENTARIOS", "OBS"],
  dniCuit: ["DNI", "CUIT", "DNI/CUIT"],
} as const;
type Columna = keyof typeof COLUMNAS;

function origenDe(t: string): Origen {
  const v = norm(t);
  if (v.includes("WHATS") || v === "WA") return "WHATSAPP";
  if (v.includes("MARKET")) return "MARKETPLACE";
  if (v.includes("FACE") || v === "FB") return "FACEBOOK";
  if (v.includes("INSTA") || v === "IG") return "INSTAGRAM";
  if (v.includes("REFER") || v.includes("RECOM")) return "REFERIDO";
  if (v.includes("SALON") || v.includes("LOCAL") || v.includes("VISITA")) return "SALON";
  return "OTRO";
}

/** Separa CSV con coma o punto y coma, respetando comillas. */
function leerCsv(texto: string): string[][] {
  const sep = (texto.split("\n")[0].match(/;/g)?.length ?? 0) > (texto.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  const cerrarCelda = () => {
    fila.push(celda);
    celda = "";
  };
  const cerrarFila = () => {
    cerrarCelda();
    filas.push(fila);
    fila = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) cerrarCelda();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      cerrarFila();
    } else celda += ch;
  }
  if (celda || fila.length) cerrarFila();
  return filas;
}

async function leerFilas(datos: ArrayBuffer, nombre: string): Promise<string[][]> {
  if (/\.csv$/i.test(nombre)) return leerCsv(new TextDecoder("utf-8").decode(datos).replace(/^\uFEFF/, ""));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(datos);
  const ws = wb.worksheets[0];
  if (!ws) throw new ErrorNegocio("La planilla está vacía");
  const filas: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, n) => {
      const v = c.value as unknown;
      vals[n - 1] =
        v == null ? "" : typeof v === "object" && "text" in (v as object) ? String((v as { text: string }).text) : typeof v === "object" && "result" in (v as object) ? String((v as { result: unknown }).result ?? "") : String(v);
    });
    filas.push(vals);
  });
  return filas;
}

export async function leerPlanillaContactos(datos: ArrayBuffer, nombreArchivo: string): Promise<FilaContacto[]> {
  const filas = await leerFilas(datos, nombreArchivo);
  const iEnc = filas.findIndex((f) => f.some((c) => ["NOMBRE", "NOMBRE Y APELLIDO", "APELLIDO Y NOMBRE", "CLIENTE", "CONTACTO"].includes(norm(c))));
  if (iEnc < 0) throw new ErrorNegocio('No se encontró la fila de encabezados (con "NOMBRE" o "CLIENTE")');

  const col: Partial<Record<Columna, number>> = {};
  filas[iEnc].forEach((c, i) => {
    const t = norm(c);
    for (const [k, nombres] of Object.entries(COLUMNAS) as [Columna, readonly string[]][]) {
      if (col[k] == null && nombres.includes(t)) col[k] = i;
    }
  });
  const get = (f: string[], k: Columna) => (col[k] != null ? String(f[col[k]!] ?? "").trim() : "");

  const resultado: FilaContacto[] = [];
  for (let i = iEnc + 1; i < filas.length; i++) {
    const f = filas[i];
    let nombre = get(f, "nombre");
    let apellido = get(f, "apellido") || null;
    if (!nombre && get(f, "nombreCompleto")) {
      const partes = get(f, "nombreCompleto").split(/\s+/);
      nombre = partes[0];
      apellido = partes.slice(1).join(" ") || null;
    }
    const telefono = get(f, "telefono") || null;
    if (!nombre && !telefono) continue;
    const dup = await buscarPorTelefono(telefono);
    resultado.push({
      fila: i + 1,
      nombre: nombre || "(sin nombre)",
      apellido,
      dniCuit: get(f, "dniCuit") || null,
      telefono,
      email: get(f, "email") || null,
      localidad: get(f, "localidad") || null,
      origen: origenDe(get(f, "origen")),
      calificacionMonto: null,
      calificacionBanco: null,
      productoInteres: get(f, "productoInteres") || null,
      usadoAEntregar: get(f, "usadoAEntregar") || null,
      observaciones: get(f, "observaciones") || null,
      proximoContacto: null,
      duplicado: dup ? `${dup.nombre} ${dup.apellido ?? ""}`.trim() : null,
    });
  }
  // Duplicados dentro del mismo archivo.
  const vistos = new Map<string, number>();
  for (const r of resultado) {
    const n = normalizarTelefono(r.telefono);
    if (!n) continue;
    if (vistos.has(n) && !r.duplicado) r.duplicado = `repetido en la fila ${vistos.get(n)}`;
    else vistos.set(n, r.fila);
  }
  return resultado;
}
