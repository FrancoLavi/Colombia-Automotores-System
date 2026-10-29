import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { baseContacto, U } from "@/test/fabricas";
import * as con from "./contactos";

beforeAll(prepararBase);

const historial = (contactoId: number) =>
  db.select().from(s.auditoria).where(and(eq(s.auditoria.entidad, "contacto"), eq(s.auditoria.entidadId, contactoId)));

describe("HU-2.3: editar y eliminar citas de la agenda", () => {
  let contacto = 0;

  beforeAll(async () => {
    contacto = await con.crearContacto(U, { ...baseContacto, nombre: "Citas", telefono: "2915550300" });
  });

  async function agendar(nota: string) {
    await con.agregarActividad(U, contacto, { tipo: "LLAMADA", fechaProgramada: new Date("2026-11-10T13:00:00Z"), realizada: false, nota });
    const [a] = await db.select().from(s.actividades).where(eq(s.actividades.nota, nota));
    return a.id;
  }

  it("edita tipo, fecha y nota de una cita pendiente y lo deja en el historial (T1)", async () => {
    const id = await agendar("Llamar por la Hilux");
    await con.editarActividad(U, id, { tipo: "VISITA", fechaProgramada: new Date("2026-11-12T18:30:00Z"), nota: "Viene al salón" });

    const a = await db.query.actividades.findFirst({ where: eq(s.actividades.id, id) });
    expect(a).toMatchObject({ tipo: "VISITA", nota: "Viene al salón", realizadaEn: null });
    expect(a!.fechaProgramada.toISOString()).toBe("2026-11-12T18:30:00.000Z");
    expect(await historial(contacto)).toContainEqual(
      expect.objectContaining({ accion: "MODIFICAR", cambios: expect.objectContaining({ tipo: ["LLAMADA", "VISITA"] }) }),
    );
  });

  it("elimina una cita pendiente y el historial guarda cómo era", async () => {
    const id = await agendar("Cita que se cae");
    await con.eliminarActividad(U, id);

    expect(await db.query.actividades.findFirst({ where: eq(s.actividades.id, id) })).toBeUndefined();
    expect(await historial(contacto)).toContainEqual(
      expect.objectContaining({ accion: "ELIMINAR", descripcion: "Eliminó la cita de llamada: Cita que se cae" }),
    );
  });

  it("no deja editar ni eliminar una cita ya hecha", async () => {
    const id = await agendar("Ya la hicimos");
    await con.completarActividad(U, id, "Atendió", null);

    await expect(con.editarActividad(U, id, { tipo: "OTRO", fechaProgramada: new Date(), nota: null })).rejects.toThrow(/ya está hecha/);
    await expect(con.eliminarActividad(U, id)).rejects.toThrow(/ya está hecha/);
  });

  it("cambia y quita la fecha de volver a contactar", async () => {
    await con.cambiarProximoContacto(U, contacto, "2026-12-01");
    expect((await db.query.contactos.findFirst({ where: eq(s.contactos.id, contacto) }))!.proximoContacto).toBe("2026-12-01");

    await con.cambiarProximoContacto(U, contacto, null);
    expect((await db.query.contactos.findFirst({ where: eq(s.contactos.id, contacto) }))!.proximoContacto).toBeNull();
    expect(await historial(contacto)).toContainEqual(expect.objectContaining({ accion: "ELIMINAR", descripcion: "Quitó el volver a contactar" }));
  });
});

describe("HU-2.4: editar y eliminar pedidos", () => {
  let contacto = 0;
  const base = { marca: "Toyota", modelo: "Hilux", anioDesde: 2017, anioHasta: null, presupuestoMax: null, notas: null };

  beforeAll(async () => {
    contacto = await con.crearContacto(U, { ...baseContacto, nombre: "Pedidos", telefono: "2915550400" });
  });

  async function pedido(notas: string) {
    await con.crearPedido(U, contacto, { ...base, notas });
    const [p] = await db.select().from(s.pedidos).where(eq(s.pedidos.notas, notas));
    return p.id;
  }

  it("edita lo que busca y lo deja en el historial (T1)", async () => {
    const id = await pedido("Doble cabina");
    await con.editarPedido(U, id, { marca: "Ford", modelo: "Ranger", anioDesde: 2018, anioHasta: 2022, presupuestoMax: 28_000_000, notas: "4x4" });

    expect(await db.query.pedidos.findFirst({ where: eq(s.pedidos.id, id) })).toMatchObject({
      marca: "Ford", modelo: "Ranger", anioDesde: 2018, anioHasta: 2022, presupuestoMax: 28_000_000, notas: "4x4",
    });
    expect(await historial(contacto)).toContainEqual(
      expect.objectContaining({ accion: "MODIFICAR", cambios: expect.objectContaining({ marca: ["Toyota", "Ford"] }) }),
    );
  });

  it("valida igual que al cargarlo", async () => {
    const id = await pedido("Para validar");
    const vacio = { marca: null, modelo: null, anioDesde: null, anioHasta: null, presupuestoMax: null, notas: null };
    await expect(con.editarPedido(U, id, vacio)).rejects.toThrow(/Completá al menos/);
    await expect(con.editarPedido(U, id, { ...base, anioDesde: 2022, anioHasta: 2018 })).rejects.toThrow(/año desde/);
  });

  it("elimina un pedido y el historial guarda cuál era", async () => {
    const id = await pedido("Cargado por error");
    await con.eliminarPedido(U, id);

    expect(await db.query.pedidos.findFirst({ where: eq(s.pedidos.id, id) })).toBeUndefined();
    expect(await historial(contacto)).toContainEqual(
      expect.objectContaining({ accion: "ELIMINAR", descripcion: "Eliminó el pedido: Toyota Hilux · desde 2017" }),
    );
  });
});

describe("búsqueda de contactos", () => {
  it("encuentra un contacto por su mail, completo o en parte y sin importar mayúsculas", async () => {
    const id = await con.crearContacto(U, { ...baseContacto, nombre: "Con mail", telefono: "2915550500", email: "Lucia.Gomez@Gmail.com" });
    for (const q of ["lucia.gomez@gmail.com", "LUCIA.GOMEZ", "gomez@gmail"]) {
      const { contactos } = await con.listarContactos({ q });
      expect(contactos.map((c) => c.id)).toContain(id);
    }
    expect((await con.listarContactos({ q: "otra@gmail.com" })).contactos.map((c) => c.id)).not.toContain(id);
  });
});
