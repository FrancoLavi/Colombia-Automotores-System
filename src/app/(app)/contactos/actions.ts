"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { entero, ErrorValidacion, fechaIso, importe, opcion, requerido, texto, type Resultado } from "@/lib/form";
import * as svc from "@/server/contactos";
import { leerPlanillaContactos } from "@/server/importar-contactos";

const ORIGENES = ["WHATSAPP", "FACEBOOK", "MARKETPLACE", "INSTAGRAM", "REFERIDO", "SALON", "OTRO"] as const;
const TIPOS = ["LLAMADA", "WHATSAPP", "VISITA", "OTRO"] as const;

function datosContacto(fd: FormData): svc.DatosContacto {
  return {
    nombre: requerido(fd, "nombre", "Nombre"),
    apellido: texto(fd, "apellido"),
    dniCuit: texto(fd, "dniCuit"),
    telefono: texto(fd, "telefono"),
    email: texto(fd, "email"),
    localidad: texto(fd, "localidad"),
    origen: opcion(fd, "origen", ORIGENES, "OTRO"),
    calificacionMonto: importe(fd, "calificacionMonto"),
    calificacionBanco: texto(fd, "calificacionBanco"),
    productoInteres: texto(fd, "productoInteres"),
    usadoAEntregar: texto(fd, "usadoAEntregar"),
    observaciones: texto(fd, "observaciones"),
    proximoContacto: fechaIso(fd, "proximoContacto"),
  };
}

export async function crearContactoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  let id = 0;
  const r = await ejecutar(async () => {
    id = await svc.crearContacto(u.id, datosContacto(fd), { ignorarDuplicado: fd.get("ignorarDuplicado") === "1" });
  });
  if (!r.ok) return r;
  revalidatePath("/contactos");
  if (fd.get("seguir") === "1") return { ok: true, mensaje: "Dato cargado. Podés cargar otro." };
  redirect(`/contactos/${id}`);
}

export async function editarContactoAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.actualizarContacto(u.id, id, datosContacto(fd));
    return "Datos guardados.";
  });
  revalidatePath(`/contactos/${id}`);
  return r;
}

export async function etapaAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.cambiarEtapaManual(u.id, id, opcion(fd, "etapa", ["DATO", "DESCARTADO"] as const)));
  revalidatePath(`/contactos/${id}`);
  revalidatePath("/contactos");
  return r;
}

export async function actividadAccion(contactoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const realizada = fd.get("modo") !== "AGENDAR";
    const fecha = fechaIso(fd, "fecha");
    const hora = texto(fd, "hora") ?? "10:00";
    if (!realizada && !fecha) throw new ErrorValidacion("Indicá la fecha a agendar");
    await svc.agregarActividad(u.id, contactoId, {
      tipo: opcion(fd, "tipo", TIPOS, "LLAMADA"),
      fechaProgramada: realizada ? new Date() : new Date(`${fecha}T${hora}:00`),
      realizada,
      nota: texto(fd, "nota"),
      proximoContacto: realizada ? fechaIso(fd, "proximoContacto") : undefined,
    });
    return realizada ? "Contacto registrado." : "Quedó agendado.";
  });
  revalidatePath(`/contactos/${contactoId}`);
  revalidatePath("/contactos/agenda");
  return r;
}

export async function completarAccion(actividadId: number | null, contactoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const nota = texto(fd, "nota");
    const proximo = fechaIso(fd, "proximoContacto");
    if (actividadId) await svc.completarActividad(u.id, actividadId, nota, proximo);
    else await svc.resolverProximo(u.id, contactoId, nota, proximo);
    return "Listo.";
  });
  revalidatePath("/contactos/agenda");
  revalidatePath(`/contactos/${contactoId}`);
  revalidatePath("/");
  return r;
}

export async function pedidoAccion(contactoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.crearPedido(u.id, contactoId, {
      marca: texto(fd, "marca"),
      modelo: texto(fd, "modelo"),
      anioDesde: entero(fd, "anioDesde"),
      anioHasta: entero(fd, "anioHasta"),
      presupuestoMax: importe(fd, "presupuestoMax"),
      notas: texto(fd, "notas"),
    });
    return "Pedido registrado.";
  });
  revalidatePath(`/contactos/${contactoId}`);
  revalidatePath("/contactos/pedidos");
  return r;
}

export async function estadoPedidoAccion(contactoId: number, pedidoId: number, estado: "ABIERTO" | "CUMPLIDO" | "DESCARTADO"): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.cambiarEstadoPedido(u.id, pedidoId, estado));
  revalidatePath(`/contactos/${contactoId}`);
  revalidatePath("/contactos/pedidos");
  return r;
}

// ---------- Importación ----------

export async function leerContactosAccion(fd: FormData): Promise<{ ok: true; filas: svc.FilaContacto[] } | { ok: false; error: string }> {
  await requerirUsuario();
  const f = fd.get("archivo");
  if (!(f instanceof File) || !f.size) return { ok: false, error: "Elegí el archivo (.xlsx o .csv)" };
  try {
    return { ok: true, filas: await leerPlanillaContactos(await f.arrayBuffer(), f.name) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el archivo" };
  }
}

export async function importarContactosAccion(filas: svc.FilaContacto[]): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const { creados, salteados } = await svc.importarContactos(u.id, filas);
    return `Se importaron ${creados} contactos${salteados ? ` (${salteados} salteados por duplicados o sin nombre)` : ""}.`;
  });
  revalidatePath("/contactos");
  return r;
}
