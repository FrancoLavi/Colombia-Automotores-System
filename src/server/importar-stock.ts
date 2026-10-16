import "server-only";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { auditar } from "@/lib/auditoria";
import { hoyIso } from "@/lib/formato";
import { interpretarDescripcion, interpretarImporte, normalizarDominio } from "@/domain/importar";
import { crearVehiculo, ErrorNegocio } from "./vehiculos";

export interface FilaImportacion {
  fila: number;
  incluir: boolean;
  descripcion: string;
  dominio: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number | null;
  km: number | null;
  color: string | null;
  precioVenta: number | null;
  costo: number | null;
  moneda: "ARS" | "USD";
  tc: number | null;
  inversor: string | null;
  ingresadoPor: string | null;
  estado: "DISPONIBLE" | "POR_INGRESAR" | "VENDIDA";
  ubicacion: "SALON" | "CHAPISTA" | "ALISTAJE" | "MECANICO" | "OTRO";
  avisos: string[];
}

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

// Encabezados reconocidos (la hoja "GENERAL" usa DESCRIPCION, MODELO = año, KMS, COLOR, PRECIO VENTA).
const COLUMNAS: Record<keyof Omit<FilaImportacion, "fila" | "incluir" | "marca" | "modelo" | "version" | "estado" | "ubicacion" | "avisos" | "moneda">, string[]> & {
  estadoCol: string[];
  ubicacionCol: string[];
  monedaCol: string[];
  marcaCol: string[];
} = {
  descripcion: ["DESCRIPCION", "AUTO", "VEHICULO"],
  dominio: ["PATENTE", "DOMINIO"],
  anio: ["MODELO", "ANO", "AÑO"],
  km: ["KMS", "KM", "KILOMETROS"],
  color: ["COLOR"],
  precioVenta: ["PRECIO VENTA", "PRECIO DE VENTA", "PRECIO"],
  costo: ["COSTO", "PRECIO COMPRA", "PRECIO DE COMPRA", "VALOR COMPRA", "TOMA"],
  tc: ["TC", "DOLAR", "TIPO DE CAMBIO"],
  inversor: ["INVERSOR", "FINANCISTA"],
  ingresadoPor: ["LO INGRESO", "INGRESADO POR"],
  estadoCol: ["ESTADO"],
  ubicacionCol: ["UBICACION"],
  monedaCol: ["MONEDA"],
  marcaCol: ["MARCA"],
};

function celdaTexto(c: ExcelJS.Cell): string | number | null {
  const v = c.value as unknown;
  if (v == null) return null;
  if (typeof v === "object") {
    if ("result" in (v as object)) return (v as { result: string | number }).result ?? null;
    if ("richText" in (v as object)) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }
  return v as string | number;
}

const claveRelleno = (c: ExcelJS.Cell) => {
  const f = c.fill as ExcelJS.FillPattern | undefined;
  return f && f.type === "pattern" && f.pattern !== "none" ? JSON.stringify(f.fgColor ?? null) : null;
};

/** Lee la planilla y devuelve una vista previa editable. Usa la hoja "GENERAL" si existe. */
export async function leerPlanilla(datos: ArrayBuffer): Promise<{ hoja: string; filas: FilaImportacion[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(datos);
  const ws = wb.getWorksheet("GENERAL") ?? wb.worksheets[0];
  if (!ws) throw new ErrorNegocio("La planilla está vacía");

  // Fila de encabezados: la primera que tenga "DESCRIPCION" o "PATENTE".
  let filaEnc = 0;
  ws.eachRow((row, n) => {
    if (filaEnc) return;
    const textos = (row.values as unknown[]).map(norm);
    if (textos.includes("DESCRIPCION") || textos.includes("PATENTE")) filaEnc = n;
  });
  if (!filaEnc) throw new ErrorNegocio('No se encontró la fila de encabezados (con "DESCRIPCION" o "PATENTE")');

  const col: Partial<Record<keyof typeof COLUMNAS, number>> = {};
  ws.getRow(filaEnc).eachCell((c, n) => {
    const t = norm(c.value);
    for (const [k, nombres] of Object.entries(COLUMNAS)) {
      if (col[k as keyof typeof COLUMNAS] == null && nombres.includes(t)) col[k as keyof typeof COLUMNAS] = n;
    }
  });

  // Leyenda de colores al pie (VENDIDA / TALLER / A INGRESAR): se compara el relleno de cada fila.
  const leyenda: Record<string, "VENDIDA" | "TALLER" | "A INGRESAR"> = {};
  ws.eachRow((row) => {
    const c = row.getCell(1);
    const t = norm(c.value);
    if (t === "VENDIDA" || t === "TALLER" || t === "A INGRESAR") {
      const k = claveRelleno(c);
      if (k) leyenda[k] = t;
    }
  });

  const filas: FilaImportacion[] = [];
  const get = (row: ExcelJS.Row, k: keyof typeof COLUMNAS) => (col[k] ? celdaTexto(row.getCell(col[k]!)) : null);

  ws.eachRow((row, n) => {
    if (n <= filaEnc) return;
    const descripcion = String(get(row, "descripcion") ?? "").replace(/\s+/g, " ").trim();
    const dominio = normalizarDominio(get(row, "dominio"));
    if (!descripcion && !dominio) return;
    const t = norm(descripcion);
    if (t === "VENDIDA" || t === "TALLER" || t === "A INGRESAR") return; // filas de la leyenda

    const avisos: string[] = [];
    const inter = interpretarDescripcion(descripcion);
    const marca = String(get(row, "marcaCol") ?? "").trim() || inter.marca || "";
    if (!marca) avisos.push("No se reconoció la marca");
    const anio = interpretarImporte(get(row, "anio"));
    const costo = interpretarImporte(get(row, "costo"));
    const tc = interpretarImporte(get(row, "tc"));
    if (!dominio) avisos.push("Sin patente");
    if (costo == null) avisos.push("Sin costo");
    if (tc == null) avisos.push("Sin dólar (se usa el de la importación)");

    const monedaTxt = norm(get(row, "monedaCol"));
    // Sin columna de moneda: un costo menor a 200.000 se interpreta en USD (como en las hojas de operación).
    const moneda: "ARS" | "USD" = monedaTxt.includes("USD") || monedaTxt.includes("DOL") ? "USD" : monedaTxt ? "ARS" : costo != null && costo < 200_000 ? "USD" : "ARS";

    const color = claveRelleno(row.getCell(1));
    const segunColor = color ? leyenda[color] : undefined;
    const estadoTxt = norm(get(row, "estadoCol"));
    let estado: FilaImportacion["estado"] = "DISPONIBLE";
    let ubicacion: FilaImportacion["ubicacion"] = "SALON";
    if (estadoTxt.includes("VEND") || segunColor === "VENDIDA") estado = "VENDIDA";
    else if (estadoTxt.includes("INGRES") || segunColor === "A INGRESAR") estado = "POR_INGRESAR";
    const ubiTxt = norm(get(row, "ubicacionCol"));
    if (segunColor === "TALLER" || ubiTxt.includes("TALLER") || ubiTxt.includes("MECAN")) ubicacion = "MECANICO";
    else if (ubiTxt.includes("CHAPA")) ubicacion = "CHAPISTA";
    else if (ubiTxt.includes("ALIST")) ubicacion = "ALISTAJE";
    if (segunColor) avisos.push(`Color de fila: ${segunColor.toLowerCase()}`);

    filas.push({
      fila: n,
      incluir: estado !== "VENDIDA",
      descripcion,
      dominio,
      marca,
      modelo: inter.modelo || descripcion,
      version: inter.version,
      anio: anio && anio > 1950 && anio < 2100 ? Math.round(anio) : null,
      km: interpretarImporte(get(row, "km")),
      color: (String(get(row, "color") ?? "").trim() || null),
      precioVenta: interpretarImporte(get(row, "precioVenta")),
      costo,
      moneda,
      tc,
      inversor: (String(get(row, "inversor") ?? "").trim() || null),
      ingresadoPor: (String(get(row, "ingresadoPor") ?? "").trim() || null),
      estado,
      ubicacion,
      avisos,
    });
  });
  return { hoja: ws.name, filas };
}

export interface OpcionesImportacion {
  tcDefecto: number;
  participeDefectoId: number;
  fechaIngreso: string;
  papelesRecibidos: boolean;
}

/** Crea los autos seleccionados. Todo o nada: si una fila falla, no se importa ninguna. */
export async function importarFilas(usuarioId: number, filas: FilaImportacion[], o: OpcionesImportacion) {
  if (!(o.tcDefecto > 0)) throw new ErrorNegocio("Indicá el dólar a usar cuando la fila no lo tiene");
  const participes = await db.select().from(s.participes);
  const elegidas = filas.filter((f) => f.incluir && f.estado !== "VENDIDA");
  if (!elegidas.length) throw new ErrorNegocio("No hay filas seleccionadas");

  return db.transaction(async (t) => {
    const ids: number[] = [];
    for (const f of elegidas) {
      if (!f.marca || !f.modelo || !f.anio) throw new ErrorNegocio(`Fila ${f.fila}: falta marca, modelo o año`);
      const porNombre = f.inversor ? participes.find((p) => norm(p.nombre) === norm(f.inversor)) : null;
      const tc = f.tc && f.tc > 0 ? f.tc : o.tcDefecto;
      const id = await crearVehiculo(
        usuarioId,
        {
          dominio: f.dominio,
          chasis: null,
          marca: f.marca,
          modelo: f.modelo,
          version: f.version,
          anio: f.anio,
          km: f.km,
          color: f.color,
          combustible: null,
          transmision: null,
          tipoIngreso: "COMPRA",
          participeId: porNombre?.id ?? o.participeDefectoId,
          ingresadoPor: f.ingresadoPor,
          contactoOrigenId: null,
          fechaIngreso: o.fechaIngreso,
          monedaCompra: f.moneda,
          valorCompra: f.costo ?? 0,
          tcIngreso: tc,
          ubicacion: f.ubicacion,
          observaciones: f.avisos.length ? `Importado (fila ${f.fila}): ${f.avisos.join(", ")}` : `Importado (fila ${f.fila})`,
        },
        { modo: "SIN_REGISTRO" },
        t,
      );
      const cambios: Partial<typeof s.vehiculos.$inferInsert> = { precioPublicado: f.precioVenta };
      if (f.estado === "DISPONIBLE") Object.assign(cambios, { estado: "DISPONIBLE", fechaDisponible: o.fechaIngreso });
      await t.update(s.vehiculos).set(cambios).where(eq(s.vehiculos.id, id));
      if (o.papelesRecibidos) {
        await t
          .update(s.documentosVehiculo)
          .set({ estado: "RECIBIDO", fechaRecepcion: hoyIso(), recibidoPor: usuarioId })
          .where(eq(s.documentosVehiculo.vehiculoId, id));
      }
      await auditar(t, { usuarioId, entidad: "vehiculo", entidadId: id, accion: "MODIFICAR", despues: cambios, descripcion: "Importado desde planilla" });
      ids.push(id);
    }
    return ids.length;
  });
}
