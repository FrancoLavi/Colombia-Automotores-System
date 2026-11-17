"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { entero, fechaIso, importeRequerido, opcion, requerido, texto, type Resultado } from "@/lib/form";
import * as svc from "@/server/valores";

// T7 · Tesorería. Sin lógica de negocio: parsea el formulario y llama al servicio.

function revalidar() {
  revalidatePath("/tesoreria");
  revalidatePath("/caja");
  revalidatePath("/caja/cuentas");
  revalidatePath("/patrimonio");
}

export async function registrarValorAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.registrarValor(u.id, {
      tipo: opcion(fd, "tipo", ["CHEQUE", "PAGARE"] as const, "CHEQUE"),
      numero: texto(fd, "numero"),
      banco: texto(fd, "banco"),
      librador: texto(fd, "librador"),
      libradorCuit: texto(fd, "libradorCuit"),
      importe: importeRequerido(fd, "importe", "Importe"),
      fechaEmision: fechaIso(fd, "fechaEmision"),
      fechaPago: requerido(fd, "fechaPago", "Fecha de pago"),
      recibidoDe: texto(fd, "recibidoDe"),
      contactoId: entero(fd, "contactoId"),
      notas: texto(fd, "notas"),
    });
    return "Valor cargado.";
  });
  revalidar();
  return r;
}

export async function depositarAccion(id: number): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.depositar(u.id, id);
    return "Depositado.";
  });
  revalidar();
  return r;
}

export async function acreditarAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.acreditar(u.id, id, opcion(fd, "medio", ["EFECTIVO", "BANCO"] as const, "BANCO"));
    return "Acreditado: la plata entró a la caja.";
  });
  revalidar();
  return r;
}

export async function endosarAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const cuenta = entero(fd, "cuentaPagarId");
    if (!cuenta) throw new Error("Elegí a qué deuda se le aplica");
    await svc.endosar(u.id, id, cuenta);
    return "Endosado. No pasó por la caja: canceló la deuda directamente.";
  });
  revalidar();
  return r;
}

export async function rechazarAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.rechazar(u.id, id, requerido(fd, "motivo", "Motivo"));
    return "Marcado como rechazado. Sigue contando como algo por cobrar.";
  });
  revalidar();
  return r;
}

export async function volverACarteraAccion(id: number): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.volverACartera(u.id, id);
    return "Vuelve a cartera.";
  });
  revalidar();
  return r;
}

export async function incobrableAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.darPorIncobrable(u.id, id, requerido(fd, "motivo", "Motivo"));
    return "Dado por incobrable: se descontó del patrimonio.";
  });
  revalidar();
  return r;
}
