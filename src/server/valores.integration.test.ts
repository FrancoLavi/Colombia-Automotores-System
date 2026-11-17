import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, fondear, U } from "@/test/fabricas";
import * as caja from "./caja";
import * as ven from "./ventas";
import * as val from "./valores";
import * as con from "./contactos";

beforeAll(async () => {
  await prepararBase();
  await fondear();
});

const contacto = (nombre: string) =>
  con.crearContacto(U, { ...baseContacto, nombre, telefono: null }, { ignorarDuplicado: true });

/** Fechas relativas a hoy: con fechas fijas el test se rompe solo al pasar el tiempo. */
const enDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Vende un auto cobrando una parte en efectivo y el resto con un cheque. */
async function ventaConCheque(dominio: string, precio: number, importeCheque: number, fechaPago = enDias(-10)) {
  const auto = await autoDisponible(dominio, { valorCompra: 5_000_000 });
  const cli = await contacto(`Cliente ${dominio}`);
  const op = await ven.crearOperacion(U, { contactoId: cli, vehiculoId: auto, precioVenta: precio, observaciones: null });
  await ven.agregarPago(U, op, {
    tipo: "EFECTIVO", importe: precio - importeCheque, fecha: enDias(0), medio: "EFECTIVO",
    banco: null, vence: null, cobradoAhora: true,
  });
  await ven.agregarPago(U, op, {
    tipo: "CHEQUE", importe: importeCheque, fecha: enDias(0), medio: "BANCO", banco: "Banco Nación", vence: null,
    cobradoAhora: false,
    cheque: { numero: "001234", librador: "Transportes del Sur SRL", libradorCuit: "30-12345678-9", fechaEmision: enDias(-20), fechaPago },
  });
  return { op, auto, cli };
}

const patrimonio = async () => (await caja.patrimonio()).total;
const cajaTotal = async () => (await caja.patrimonio()).caja.total;

describe("T7 · un cheque recibido en una venta", () => {
  it("no entra a la caja, pero al cerrar la venta queda como cuenta a cobrar", async () => {
    const cajaAntes = await cajaTotal();
    const { op } = await ventaConCheque("CH100AA", 9_000_000, 4_000_000);

    // El efectivo entró; el cheque no.
    expect(await cajaTotal()).toBe(cajaAntes + 5_000_000);

    const [valor] = await val.listarValores();
    expect(valor).toMatchObject({ estado: "EN_CARTERA", importe: 4_000_000, sinCuenta: true });
    expect(valor.deQuien).toBe("Transportes del Sur SRL");

    // La venta se puede cerrar: el cheque cuenta como cobertura (si no, nunca cerraría).
    await ven.cerrarOperacion(U, op, null);
    const despues = (await val.listarValores()).find((v) => v.id === valor.id)!;
    expect(despues.sinCuenta).toBe(false);
    expect(despues.cuenta).toMatchObject({ tipo: "A_COBRAR", origen: "VALOR", saldo: 4_000_000, estado: "ABIERTA" });
    // El patrimonio lo cuenta por esa cuenta, sin que haya que tocar su fórmula.
    expect((await caja.patrimonio()).aCobrar).toBe(4_000_000);
  });

  it("acreditarlo mueve la plata del 'a cobrar' a la caja, sin cambiar el patrimonio", async () => {
    const [valor] = (await val.listarValores()).filter((v) => v.estado === "EN_CARTERA");
    const patAntes = await patrimonio();
    const cajaAntes = await cajaTotal();

    await val.depositar(U, valor.id);
    // Depositado todavía no es plata: nada se movió.
    expect(await cajaTotal()).toBe(cajaAntes);
    expect(await patrimonio()).toBe(patAntes);

    await val.acreditar(U, valor.id, "BANCO");
    expect(await cajaTotal()).toBe(cajaAntes + 4_000_000);
    expect((await caja.patrimonio()).aCobrar).toBe(0);
    // La plata cambió de lugar, el patrimonio no cambia.
    expect(await patrimonio()).toBe(patAntes);
    expect((await val.listarValores()).find((v) => v.id === valor.id)!.estado).toBe("ACREDITADO");
  });
});

describe("T7 · endoso", () => {
  it("cancela la deuda y el cheque sin tocar la caja, y el patrimonio queda igual", async () => {
    const { op } = await ventaConCheque("CH200BB", 9_000_000, 3_000_000);
    await ven.cerrarOperacion(U, op, null);
    const valor = (await val.listarValores()).find((v) => v.estado === "EN_CARTERA" && v.importe === 3_000_000)!;

    await caja.crearCuenta(U, { tipo: "A_PAGAR", contraparte: "Chapista Gómez", importe: 3_000_000, vencimiento: null, notas: "Chapa y pintura" });
    const deuda = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Chapista Gómez")!.c;

    const patAntes = await patrimonio();
    const cajaAntes = await cajaTotal();
    await val.endosar(U, valor.id, deuda.id);

    // Lo esencial: no se movió un peso de la caja.
    expect(await cajaTotal()).toBe(cajaAntes);
    // Se fue un activo y se fue una deuda del mismo valor: el patrimonio no cambia.
    expect(await patrimonio()).toBe(patAntes);

    const cerrada = await db.query.cuentasPendientes.findFirst({ where: eq(s.cuentasPendientes.id, deuda.id) });
    expect(cerrada).toMatchObject({ saldo: 0, estado: "CANCELADA" });
    const endosado = (await val.listarValores()).find((v) => v.id === valor.id)!;
    expect(endosado).toMatchObject({ estado: "ENDOSADO", endosadoA: "Chapista Gómez" });
    expect(endosado.cuenta).toMatchObject({ saldo: 0, estado: "CANCELADA" });
  });

  it("no se endosa por menos de lo que vale: un cheque se entrega entero", async () => {
    const { op } = await ventaConCheque("CH300CC", 9_000_000, 3_500_000);
    await ven.cerrarOperacion(U, op, null);
    const valor = (await val.listarValores()).find((v) => v.estado === "EN_CARTERA")!;
    await caja.crearCuenta(U, { tipo: "A_PAGAR", contraparte: "Gestoría Luna", importe: 1_000_000, vencimiento: null, notas: null });
    const chica = (await caja.listarCuentas({ tipo: "A_PAGAR" })).find((x) => x.c.contraparte === "Gestoría Luna")!.c;
    await expect(val.endosar(U, valor.id, chica.id)).rejects.toThrow(/se endosa entero/);
  });
});

describe("T7 · rechazo e incobrable", () => {
  it("un rechazado sigue contando como a cobrar: avisa, pero todavía no es pérdida", async () => {
    const valor = (await val.listarValores()).find((v) => v.estado === "EN_CARTERA")!;
    const patAntes = await patrimonio();

    await val.rechazar(U, valor.id, "Sin fondos suficientes");
    const rechazado = (await val.listarValores()).find((v) => v.id === valor.id)!;
    expect(rechazado.estado).toBe("RECHAZADO");
    expect(rechazado.alarma).toBe("RECHAZADO");
    // Clave: todavía no se perdió nada. Se le sigue reclamando al librador.
    expect(rechazado.cuenta).toMatchObject({ estado: "ABIERTA" });
    expect(await patrimonio()).toBe(patAntes);
  });

  it("recién al darlo por incobrable el patrimonio baja, y esa es la pérdida", async () => {
    const valor = (await val.listarValores()).find((v) => v.estado === "RECHAZADO")!;
    const patAntes = await patrimonio();
    const cajaAntes = await cajaTotal();

    await expect(val.darPorIncobrable(U, valor.id, "  ")).rejects.toThrow(/Explicá/);
    await val.darPorIncobrable(U, valor.id, "Incobrable tras dos reclamos");

    expect(await patrimonio()).toBe(patAntes - valor.importe);
    // No es un egreso: nunca salió plata de la caja, simplemente dejó de existir un activo.
    expect(await cajaTotal()).toBe(cajaAntes);
    expect((await val.listarValores()).find((v) => v.id === valor.id)!.cuenta).toMatchObject({ estado: "CANCELADA", saldo: 0 });
  });
});

describe("T7 · cheque cargado desde tesorería", () => {
  it("crea su cuenta a cobrar en el acto y el patrimonio lo suma", async () => {
    const patAntes = await patrimonio();
    const id = await val.registrarValor(U, {
      tipo: "CHEQUE", numero: "999", banco: "Banco Provincia", librador: "Molinos Díaz SA", libradorCuit: null,
      importe: 2_500_000, fechaEmision: enDias(-16), fechaPago: enDias(33),
      recibidoDe: "Molinos Díaz SA", contactoId: null, notas: null,
    });
    expect(await patrimonio()).toBe(patAntes + 2_500_000);
    const v = (await val.listarValores()).find((x) => x.id === id)!;
    expect(v.cuenta).toMatchObject({ tipo: "A_COBRAR", origen: "VALOR", saldo: 2_500_000 });
  });

  it("no acepta importes en cero ni fechas al revés", async () => {
    const base = {
      tipo: "CHEQUE" as const, numero: null, banco: null, librador: "X", libradorCuit: null,
      importe: 100, fechaEmision: enDias(14), fechaPago: enDias(33),
      recibidoDe: null, contactoId: null, notas: null,
    };
    await expect(val.registrarValor(U, { ...base, importe: 0 })).rejects.toThrow(/mayor a cero/);
    await expect(val.registrarValor(U, { ...base, fechaPago: enDias(1) })).rejects.toThrow(/anterior a la de emisión/);
  });
});
