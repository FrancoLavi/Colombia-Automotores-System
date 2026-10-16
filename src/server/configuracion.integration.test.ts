import { beforeAll, describe, expect, it } from "vitest";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, U } from "@/test/fabricas";
import { hoyIso } from "@/lib/formato";
import { periodoDe } from "@/domain/dashboard";
import * as veh from "./vehiculos";
import * as con from "./contactos";
import * as ven from "./ventas";
import * as cfg from "./configuracion";
import * as par from "./parametros";
import { tablero } from "./dashboard";

beforeAll(prepararBase);

describe("tablero de inicio", () => {
  it("cuenta las ventas y la ganancia del mes, con el objetivo automático o el cargado", async () => {
    const auto = await autoDisponible("AA111AA");
    await autoDisponible("BB222BB");
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Marcos", telefono: "2915550142" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 11_500_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "TRANSFERENCIA", importe: 11_500_000, fecha: hoyIso(), medio: "BANCO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, null);

    let t = await tablero();
    expect(t.vendidos).toBe(1);
    expect(t.ganancia).toBe(1_500_000);
    expect(t.gananciaInversores).toBe(750_000);
    expect(t.objetivo.unidades).toEqual({ valor: 1, automatico: true }); // mitad de 2 autos
    expect(t.ventas12.at(-1)!.ventas).toBe(1);

    await cfg.guardarObjetivo(U, periodoDe(new Date()), 10, 15_000_000);
    t = await tablero();
    expect(t.objetivo.unidades).toEqual({ valor: 10, automatico: false });
    expect(t.objetivo.ganancia).toBe(15_000_000);
  });
});

describe("parámetros", () => {
  it("el margen base configurado cambia el precio sugerido y el reparto de las ventas nuevas", async () => {
    const p = await par.obtenerParametros();
    expect(p.margenBase).toBe(0.15);
    await par.guardarParametros(U, { ...p, margenBase: 0.2 });
    const auto = await autoDisponible("CC333CC");
    expect((await veh.fichaVehiculo(auto))!.sugerido).toBe(12_000_000);
    const cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Ana", telefono: "2914440000" });
    const op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 12_000_000, observaciones: null });
    await ven.agregarPago(U, op, { tipo: "EFECTIVO", importe: 12_000_000, fecha: hoyIso(), medio: "EFECTIVO", banco: null, vence: null, cobradoAhora: true });
    await ven.cerrarOperacion(U, op, null);
    const l = (await ven.fichaOperacion(op))!.liquidacion!;
    expect(l).toMatchObject({ gananciaBase: 2_000_000, parteInversor: 1_000_000, parteSalon: 1_000_000 });
    await par.guardarParametros(U, { ...p, margenBase: 0.15 });
  });

  it("valida rangos", async () => {
    const p = await par.obtenerParametros();
    await expect(par.guardarParametros(U, { ...p, margenBase: 1.5 })).rejects.toThrow(/margen base/);
    await expect(par.guardarParametros(U, { ...p, diasCritico: 10, diasAviso: 30 })).rejects.toThrow(/crítica/);
  });
});

describe("usuarios", () => {
  it("valida mail, contraseña e inversor, y no deja sin administradores", async () => {
    await expect(cfg.crearUsuario(U, { nombre: "X", email: "no-es-mail", password: "12345678", rol: "ADMIN", participeId: null })).rejects.toThrow(/Mail/);
    await expect(cfg.crearUsuario(U, { nombre: "X", email: "x@local.test", password: "corta", rol: "ADMIN", participeId: null })).rejects.toThrow(/8 caracteres/);
    await expect(cfg.crearUsuario(U, { nombre: "X", email: "x@local.test", password: "12345678", rol: "INVERSOR", participeId: null })).rejects.toThrow(/inversor/);
    await cfg.crearUsuario(U, { nombre: "Inv", email: "INV@local.test", password: "12345678", rol: "INVERSOR", participeId: 2 });
    await expect(cfg.crearUsuario(U, { nombre: "Otro", email: "inv@local.test", password: "12345678", rol: "ADMIN", participeId: null })).rejects.toThrow(/Ya existe/);
    await expect(cfg.cambiarActivoUsuario(U, U, false)).rejects.toThrow(/propio usuario/);
    await expect(cfg.cambiarPassword(U, U, "nueva-clave-1", "incorrecta")).rejects.toThrow(/actual/);
  });
});
