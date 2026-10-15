"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { entero, fechaIso, importe, importeRequerido, opcion, requerido, texto, type Resultado } from "@/lib/form";
import { normalizarDominio } from "@/domain/importar";
import { hoyIso } from "@/lib/formato";
import { guardarArchivo, borrarArchivo } from "@/lib/almacenamiento";
import * as svc from "@/server/vehiculos";
import { leerPlanilla, importarFilas, type FilaImportacion, type OpcionesImportacion } from "@/server/importar-stock";

const UBICACIONES = ["SALON", "CHAPISTA", "ALISTAJE", "MECANICO", "OTRO"] as const;

function datosVehiculo(fd: FormData): svc.DatosVehiculo {
  const anio = entero(fd, "anio");
  if (!anio || anio < 1950 || anio > 2100) throw new svc.ErrorNegocio("Año inválido");
  const tipoIngreso = opcion(fd, "tipoIngreso", ["COMPRA", "PERMUTA", "CONSIGNACION"] as const);
  return {
    dominio: normalizarDominio(fd.get("dominio")),
    chasis: texto(fd, "chasis"),
    marca: requerido(fd, "marca", "Marca"),
    modelo: requerido(fd, "modelo", "Modelo"),
    version: texto(fd, "version"),
    anio,
    km: entero(fd, "km"),
    color: texto(fd, "color"),
    combustible: texto(fd, "combustible"),
    transmision: texto(fd, "transmision"),
    tipoIngreso,
    participeId: Number(requerido(fd, "participeId", "Quién financia")),
    ingresadoPor: texto(fd, "ingresadoPor"),
    contactoOrigenId: texto(fd, "contactoOrigenId") ? Number(texto(fd, "contactoOrigenId")) : null,
    fechaIngreso: fechaIso(fd, "fechaIngreso") ?? hoyIso(),
    monedaCompra: opcion(fd, "monedaCompra", ["ARS", "USD"] as const, "ARS"),
    valorCompra: importeRequerido(fd, "valorCompra", tipoIngreso === "CONSIGNACION" ? "Monto pactado con el dueño" : "Valor de compra"),
    tcIngreso: importeRequerido(fd, "tcIngreso", "Dólar blue fijado"),
    ubicacion: opcion(fd, "ubicacion", UBICACIONES, "SALON"),
    observaciones: texto(fd, "observaciones"),
  };
}

export async function crearVehiculoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  let id = 0;
  const r = await ejecutar(async () => {
    const d = datosVehiculo(fd);
    const modo = opcion(fd, "pagoModo", ["PAGADO", "A_PAGAR", "SIN_REGISTRO"] as const, "SIN_REGISTRO");
    const pago: svc.PagoCompra =
      modo === "PAGADO"
        ? { modo, medio: opcion(fd, "pagoMedio", ["EFECTIVO", "BANCO"] as const, "EFECTIVO") }
        : modo === "A_PAGAR"
          ? { modo, vencimiento: fechaIso(fd, "pagoVencimiento") }
          : { modo };
    id = await svc.crearVehiculo(u.id, d, pago);
  });
  if (!r.ok) return r;
  revalidatePath("/stock");
  redirect(`/stock/${id}`);
}

export async function editarVehiculoAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.actualizarVehiculo(u.id, id, datosVehiculo(fd)));
  if (!r.ok) return r;
  revalidatePath(`/stock/${id}`);
  redirect(`/stock/${id}`);
}

export async function ubicacionAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.cambiarUbicacion(u.id, id, opcion(fd, "ubicacion", UBICACIONES)));
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function estadoAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const estado = opcion(fd, "estado", ["POR_INGRESAR", "RECHAZADO", "BAJA"] as const);
    await svc.cambiarEstadoManual(u.id, id, estado, texto(fd, "motivo"));
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma de useActionState
export async function habilitarAccion(id: number, _prev: Resultado): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.habilitarVenta(u.id, id);
    return "El auto quedó disponible para la venta.";
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function precioAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.actualizarPrecio(u.id, id, importe(fd, "ajustePrecio") ?? 0, importe(fd, "precioPublicado"));
    return "Precio guardado.";
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function documentoAccion(vehiculoId: number, documentoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() =>
    svc.registrarDocumento(u.id, vehiculoId, documentoId, opcion(fd, "estado", ["PENDIENTE", "RECIBIDO", "NO_APLICA"] as const), fechaIso(fd, "fechaVencimiento")),
  );
  revalidatePath(`/stock/${vehiculoId}`);
  return r;
}

export async function peritajeAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.guardarPeritaje(u.id, id, {
      fecha: fechaIso(fd, "fecha") ?? hoyIso(),
      perito: texto(fd, "perito"),
      resultado: opcion(fd, "resultado", ["APTO", "APTO_CON_OBS", "NO_APTO"] as const),
      reparacionEstimada: importe(fd, "reparacionEstimada"),
      observaciones: texto(fd, "observaciones"),
    });
    return "Peritaje guardado.";
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function gastoAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.agregarGasto(u.id, id, {
      categoriaId: Number(requerido(fd, "categoriaId", "Categoría")),
      fecha: fechaIso(fd, "fecha") ?? hoyIso(),
      descripcion: texto(fd, "descripcion"),
      importe: importeRequerido(fd, "importe", "Importe"),
      estado: opcion(fd, "estado", ["PAGADO", "PENDIENTE"] as const, "PAGADO"),
      medio: opcion(fd, "medio", ["EFECTIVO", "BANCO"] as const, "EFECTIVO"),
    });
    return "Gasto cargado.";
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function eliminarGastoAccion(id: number, gastoId: number): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.eliminarGasto(u.id, id, gastoId));
  revalidatePath(`/stock/${id}`);
  return r;
}

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

export async function subirFotosAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const tipo = opcion(fd, "tipo", ["FOTO_PERITAJE", "DOCUMENTO", "OTRO"] as const, "FOTO_PERITAJE");
    const archivos = fd.getAll("archivos").filter((x): x is File => x instanceof File && x.size > 0);
    if (!archivos.length) throw new svc.ErrorNegocio("Elegí al menos una foto");
    for (const a of archivos) {
      if (!TIPOS_IMAGEN.includes(a.type) && a.type !== "application/pdf") throw new svc.ErrorNegocio(`Formato no admitido: ${a.name}`);
      if (a.size > 4 * 1024 * 1024) throw new svc.ErrorNegocio(`El archivo ${a.name} supera los 4 MB`);
      const ext = a.type === "application/pdf" ? "pdf" : a.type.split("/")[1].replace("jpeg", "jpg");
      const clave = `vehiculos/${id}/${randomUUID()}.${ext}`;
      await guardarArchivo(clave, Buffer.from(await a.arrayBuffer()), a.type);
      await svc.registrarArchivo(u.id, id, { tipo, url: clave, nombre: a.name });
    }
    return archivos.length === 1 ? "Foto subida." : `${archivos.length} fotos subidas.`;
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function quitarArchivoAccion(id: number, archivoId: number): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const clave = await svc.quitarArchivo(u.id, id, archivoId);
    await borrarArchivo(clave);
  });
  revalidatePath(`/stock/${id}`);
  return r;
}

export async function tipoCambioAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.guardarTipoCambio(u.id, fechaIso(fd, "fecha") ?? hoyIso(), importeRequerido(fd, "valor", "Dólar blue"));
    return "Dólar guardado.";
  });
  revalidatePath("/stock");
  revalidatePath("/");
  return r;
}

// ---------- Importación ----------

export async function leerPlanillaAccion(fd: FormData): Promise<{ ok: true; hoja: string; filas: FilaImportacion[] } | { ok: false; error: string }> {
  await requerirUsuario();
  const f = fd.get("archivo");
  if (!(f instanceof File) || !f.size) return { ok: false, error: "Elegí el archivo .xlsx" };
  try {
    const { hoja, filas } = await leerPlanilla(await f.arrayBuffer());
    return { ok: true, hoja, filas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer la planilla" };
  }
}

export async function importarAccion(filas: FilaImportacion[], o: OpcionesImportacion): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const n = await importarFilas(u.id, filas, o);
    return `Se importaron ${n} autos.`;
  });
  revalidatePath("/stock");
  return r;
}
