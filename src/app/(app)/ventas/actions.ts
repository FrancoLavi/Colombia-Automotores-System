"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { entero, ErrorValidacion, fechaIso, importe, importeRequerido, opcion, requerido, texto, type Resultado } from "@/lib/form";
import { normalizarDominio } from "@/domain/importar";
import { hoyIso } from "@/lib/formato";
import * as svc from "@/server/ventas";

const MEDIOS = ["EFECTIVO", "BANCO"] as const;

function revalidar(id: number) {
  revalidatePath(`/ventas/${id}`);
  revalidatePath("/ventas");
  revalidatePath("/stock");
  revalidatePath("/caja");
  revalidatePath("/");
}

export async function crearVentaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  let id = 0;
  const r = await ejecutar(async () => {
    id = await svc.crearOperacion(u.id, {
      contactoId: Number(requerido(fd, "contactoId", "Cliente")),
      vehiculoId: Number(requerido(fd, "vehiculoId", "Auto")),
      precioVenta: importeRequerido(fd, "precioVenta", "Precio de venta"),
      observaciones: texto(fd, "observaciones"),
    });
  });
  if (!r.ok) return r;
  revalidatePath("/ventas");
  redirect(`/ventas/${id}`);
}

export async function precioAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.cambiarPrecio(u.id, id, importeRequerido(fd, "precioVenta", "Precio"), texto(fd, "observaciones"));
    return "Guardado.";
  });
  revalidar(id);
  return r;
}

export async function pagoAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const tipo = opcion(fd, "tipo", ["SENIA", "EFECTIVO", "TRANSFERENCIA", "CREDITO", "OTRO"] as const);
    await svc.agregarPago(u.id, id, {
      tipo,
      importe: importeRequerido(fd, "importe", "Importe"),
      fecha: fechaIso(fd, "fecha") ?? hoyIso(),
      medio: opcion(fd, "medio", MEDIOS, "EFECTIVO"),
      banco: texto(fd, "banco"),
      vence: fechaIso(fd, "vence"),
      cobradoAhora: fd.get("cobradoAhora") !== "NO",
    });
    return tipo === "SENIA" ? "Seña registrada: el auto quedó reservado." : "Pago registrado.";
  });
  revalidar(id);
  return r;
}

export async function permutaAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const anio = entero(fd, "anio");
    if (!anio || anio < 1950 || anio > 2100) throw new ErrorValidacion("Año inválido");
    await svc.tomarUsado(u.id, id, {
      dominio: normalizarDominio(fd.get("dominio")),
      chasis: null,
      marca: requerido(fd, "marca", "Marca"),
      modelo: requerido(fd, "modelo", "Modelo"),
      version: texto(fd, "version"),
      anio,
      km: entero(fd, "km"),
      color: texto(fd, "color"),
      combustible: null,
      transmision: null,
      participeId: Number(requerido(fd, "participeId", "Quién financia")),
      ingresadoPor: null,
      fechaIngreso: hoyIso(),
      monedaCompra: opcion(fd, "monedaCompra", ["ARS", "USD"] as const, "ARS"),
      valorCompra: importeRequerido(fd, "valorCompra", "Valor de toma"),
      tcIngreso: importeRequerido(fd, "tcIngreso", "Dólar blue"),
      ubicacion: "SALON",
      observaciones: texto(fd, "observaciones"),
    });
    return "Usado tomado: quedó en stock como \"por ingresar\" para cargarle papeles y peritaje.";
  });
  revalidar(id);
  return r;
}

export async function quitarPagoAccion(id: number, pagoId: number): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.quitarPago(u.id, id, pagoId));
  revalidar(id);
  return r;
}

export async function cerrarAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.cerrarOperacion(u.id, id, importe(fd, "tcVenta"));
    return "Venta cerrada.";
  });
  revalidar(id);
  return r;
}

export async function entregarAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const f = fechaIso(fd, "fecha") ?? hoyIso();
    const h = texto(fd, "hora") ?? "12:00";
    if (!/^\d{2}:\d{2}$/.test(h)) throw new ErrorValidacion("Hora inválida");
    await svc.entregarOperacion(u.id, id, new Date(`${f}T${h}:00`));
    return "Entrega registrada.";
  });
  revalidar(id);
  return r;
}

export async function caerAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.caerOperacion(u.id, id, requerido(fd, "motivo", "Motivo"), opcion(fd, "sena", ["DEVOLVER", "RETENER"] as const, "DEVOLVER"), opcion(fd, "medio", MEDIOS, "EFECTIVO"));
    return "Operación dada de baja.";
  });
  revalidar(id);
  return r;
}

export async function cobrarAccion(id: number, pagoId: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.cobrarPagoPendiente(u.id, id, pagoId, opcion(fd, "medio", MEDIOS, "EFECTIVO"));
    return "Cobrado.";
  });
  revalidar(id);
  return r;
}
