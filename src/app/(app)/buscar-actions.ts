"use server";

import { requerirUsuario } from "@/lib/auth";
import { buscarGlobal, type ResultadoBusqueda } from "@/server/buscar";

export async function buscarAccion(q: string): Promise<ResultadoBusqueda[]> {
  await requerirUsuario();
  return buscarGlobal(q);
}
