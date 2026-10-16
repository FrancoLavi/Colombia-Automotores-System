"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { ErrorValidacion, entero, importe, importeRequerido, opcion, requerido, texto, type Resultado } from "@/lib/form";
import * as cfg from "@/server/configuracion";
import { guardarParametros } from "@/server/parametros";

function revalidar() {
  revalidatePath("/configuracion");
  revalidatePath("/");
}

const pct = (fd: FormData, k: string, etiqueta: string) => importeRequerido(fd, k, etiqueta) / 100;

export async function parametrosAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await guardarParametros(u.id, {
      margenBase: pct(fd, "margenBase", "Margen base"),
      umbralMargenUsd: pct(fd, "umbralMargenUsd", "Umbral de margen en USD"),
      diasAviso: entero(fd, "diasAviso") ?? 0,
      diasCritico: entero(fd, "diasCritico") ?? 0,
      diasAvisoVencimiento: entero(fd, "diasAvisoVencimiento") ?? 0,
    });
    return "Parámetros guardados. Aplican a precios sugeridos y ventas que se cierren desde ahora.";
  });
  revalidar();
  revalidatePath("/stock");
  return r;
}

export async function objetivoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const periodo = requerido(fd, "periodo", "Mes");
    await cfg.guardarObjetivo(u.id, periodo, entero(fd, "unidades") ?? 0, importe(fd, "ganancia") ?? 0);
    return "Objetivo guardado.";
  });
  revalidar();
  return r;
}

export async function inversorAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await cfg.crearInversor(u.id, requerido(fd, "nombre", "Nombre"));
    return "Inversor agregado.";
  });
  revalidar();
  return r;
}

export async function editarParticipeAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await cfg.editarParticipe(u.id, id, requerido(fd, "nombre", "Nombre"), fd.get("activo") === "on");
    return "Guardado.";
  });
  revalidar();
  return r;
}

export async function usuarioAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const rol = opcion(fd, "rol", ["ADMIN", "INVERSOR"] as const, "ADMIN");
    await cfg.crearUsuario(u.id, {
      nombre: requerido(fd, "nombre", "Nombre"),
      email: requerido(fd, "email", "Mail"),
      password: requerido(fd, "password", "Contraseña"),
      rol,
      participeId: texto(fd, "participeId") ? Number(texto(fd, "participeId")) : null,
    });
    return "Usuario creado. Pasale el mail y la contraseña para que entre.";
  });
  revalidar();
  return r;
}

export async function activoUsuarioAccion(id: number, activo: boolean): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => cfg.cambiarActivoUsuario(u.id, id, activo));
  revalidar();
  return r;
}

export async function resetPasswordAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await cfg.cambiarPassword(u.id, id, requerido(fd, "password", "Contraseña nueva"));
    return "Contraseña cambiada.";
  });
  return r;
}

export async function miPasswordAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario({ permitirInversor: true });
  return ejecutar(async () => {
    const nueva = requerido(fd, "nueva", "Contraseña nueva");
    if (nueva !== texto(fd, "repetir")) throw new ErrorValidacion("Las contraseñas nuevas no coinciden");
    await cfg.cambiarPassword(u.id, u.id, nueva, requerido(fd, "actual", "Contraseña actual"));
    return "Contraseña cambiada.";
  });
}

export async function documentoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await cfg.crearTipoDocumento(u.id, requerido(fd, "nombre", "Nombre"), fd.get("obligatorio") === "on", fd.get("vencimiento") === "on");
    return "Papel agregado. Aplica a los autos que ingresen desde ahora.";
  });
  revalidar();
  return r;
}

export async function editarDocumentoAccion(id: number, campo: "obligatorio" | "tieneVencimiento" | "activo", valor: boolean, actual: { obligatorio: boolean; tieneVencimiento: boolean; activo: boolean }): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => cfg.editarTipoDocumento(u.id, id, { ...actual, [campo]: valor }));
  revalidar();
  return r;
}

export async function categoriaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await cfg.crearCategoria(u.id, requerido(fd, "nombre", "Nombre"));
    return "Categoría agregada.";
  });
  revalidar();
  return r;
}

export async function activoCategoriaAccion(id: number, activo: boolean): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => cfg.cambiarActivoCategoria(u.id, id, activo));
  revalidar();
  return r;
}
