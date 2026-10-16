"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth";
import { ejecutar } from "@/lib/acciones";
import { fechaIso, importeRequerido, opcion, requerido, texto, type Resultado } from "@/lib/form";
import { hoyIso } from "@/lib/formato";
import { MANUALES, type CategoriaManual } from "@/domain/caja";
import * as svc from "@/server/caja";

const MEDIOS = ["EFECTIVO", "BANCO"] as const;

function revalidar() {
  for (const p of ["/caja", "/caja/cuentas", "/caja/inversores", "/", "/ventas"]) revalidatePath(p);
}

/** Fecha del formulario con la hora actual (para ordenar bien los movimientos del día). */
function fechaConHora(fd: FormData) {
  const f = fechaIso(fd, "fecha") ?? hoyIso();
  const ahora = new Date();
  return f === hoyIso() ? ahora : new Date(`${f}T12:00:00`);
}

export async function movimientoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    const tipo = requerido(fd, "categoria", "Tipo de movimiento");
    if (tipo === "TRANSFERENCIA_INTERNA") {
      await svc.transferenciaInterna(u.id, { desde: opcion(fd, "medio", MEDIOS), importe: importeRequerido(fd, "importe", "Importe"), fecha: fechaConHora(fd), concepto: texto(fd, "concepto") });
      return "Pase registrado.";
    }
    const categoria = opcion(fd, "categoria", Object.keys(MANUALES) as CategoriaManual[]);
    await svc.crearMovimiento(u.id, {
      categoria,
      sentido: categoria === "AJUSTE" ? opcion(fd, "sentido", ["INGRESO", "EGRESO"] as const) : null,
      medio: opcion(fd, "medio", MEDIOS),
      importe: importeRequerido(fd, "importe", "Importe"),
      concepto: requerido(fd, "concepto", "Concepto"),
      fecha: fechaConHora(fd),
      participeId: texto(fd, "participeId") ? Number(texto(fd, "participeId")) : null,
    });
    return "Movimiento registrado.";
  });
  revalidar();
  return r;
}

export async function anularAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(() => svc.anularMovimiento(u.id, id, requerido(fd, "motivo", "Motivo")));
  revalidar();
  return r;
}

export async function pagarGananciaAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.pagarDistribucion(u.id, id, opcion(fd, "medio", MEDIOS, "EFECTIVO"));
    return "Pagado.";
  });
  revalidar();
  return r;
}

export async function crearCuentaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.crearCuenta(u.id, {
      tipo: opcion(fd, "tipo", ["A_COBRAR", "A_PAGAR"] as const),
      contraparte: requerido(fd, "contraparte", "Con quién"),
      importe: importeRequerido(fd, "importe", "Importe"),
      vencimiento: fechaIso(fd, "vencimiento"),
      notas: texto(fd, "notas"),
    });
    return "Cuenta registrada.";
  });
  revalidar();
  return r;
}

export async function pagoCuentaAccion(id: number, _: Resultado, fd: FormData): Promise<Resultado> {
  const u = await requerirUsuario();
  const r = await ejecutar(async () => {
    await svc.registrarPagoCuenta(u.id, id, importeRequerido(fd, "importe", "Importe"), opcion(fd, "medio", MEDIOS, "EFECTIVO"));
    return "Registrado.";
  });
  revalidar();
  return r;
}
