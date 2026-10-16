import "server-only";
import { db, schema as s } from "@/db";
import { auditar } from "@/lib/auditoria";
import { MARGEN_BASE } from "@/domain/negocio";
import { PARAMETROS_ALERTAS_DEFECTO, type ParametrosAlertas } from "@/domain/stock";
import { ErrorNegocio } from "./errores";

export interface Parametros extends ParametrosAlertas {
  margenBase: number;
}

const CLAVES: Record<keyof Parametros, string> = {
  margenBase: "margen_base",
  umbralMargenUsd: "umbral_margen_usd",
  diasAviso: "dias_alerta_stock",
  diasCritico: "dias_alerta_stock_critica",
  diasAvisoVencimiento: "dias_aviso_vencimiento",
};

const DEFECTO: Parametros = { margenBase: MARGEN_BASE, ...PARAMETROS_ALERTAS_DEFECTO };

/** Parámetros de negocio (margen, umbrales de alertas). Lo que falte toma el valor por defecto. */
export async function obtenerParametros(): Promise<Parametros> {
  const filas = await db.select().from(s.parametros);
  const p = { ...DEFECTO };
  for (const [k, clave] of Object.entries(CLAVES) as [keyof Parametros, string][]) {
    const f = filas.find((x) => x.clave === clave);
    const n = f ? Number(f.valor) : NaN;
    if (Number.isFinite(n)) p[k] = n;
  }
  return p;
}

export async function guardarParametros(usuarioId: number, nuevos: Parametros) {
  if (!(nuevos.margenBase > 0 && nuevos.margenBase < 1)) throw new ErrorNegocio("El margen base tiene que estar entre 0 % y 100 %");
  if (!(nuevos.umbralMargenUsd >= 0 && nuevos.umbralMargenUsd < 1)) throw new ErrorNegocio("El umbral de margen en USD tiene que estar entre 0 % y 100 %");
  if (!(nuevos.diasAviso > 0 && nuevos.diasCritico > nuevos.diasAviso)) throw new ErrorNegocio("Los días de alerta crítica tienen que ser más que los de aviso");
  if (!(nuevos.diasAvisoVencimiento >= 0)) throw new ErrorNegocio("Días de aviso de vencimiento inválidos");
  const antes = await obtenerParametros();
  await db.transaction(async (t) => {
    for (const [k, clave] of Object.entries(CLAVES) as [keyof Parametros, string][]) {
      await t.insert(s.parametros).values({ clave, valor: String(nuevos[k]) }).onConflictDoUpdate({ target: s.parametros.clave, set: { valor: String(nuevos[k]) } });
    }
    await auditar(t, { usuarioId, entidad: "configuracion", entidadId: 0, accion: "MODIFICAR", antes: { ...antes }, despues: { ...nuevos }, descripcion: "Parámetros de negocio" });
  });
}
