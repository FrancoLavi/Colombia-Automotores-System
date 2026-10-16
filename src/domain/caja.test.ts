import { describe, it, expect } from "vitest";
import { cuentaEnPatrimonio, esManual, saldos, valorStock } from "./caja";

describe("saldos de caja", () => {
  it("suma por medio y no cuenta anulados", () => {
    expect(
      saldos([
        { sentido: "INGRESO", medio: "EFECTIVO", importe: 300_000, anulado: false },
        { sentido: "INGRESO", medio: "BANCO", importe: 19_700_000, anulado: false },
        { sentido: "EGRESO", medio: "EFECTIVO", importe: 50_000, anulado: false },
        { sentido: "INGRESO", medio: "EFECTIVO", importe: 999_999, anulado: true },
      ]),
    ).toEqual({ efectivo: 250_000, banco: 19_700_000, total: 19_950_000 });
  });
});

describe("autos en el patrimonio (K3)", () => {
  const base = { estado: "DISPONIBLE", tipoIngreso: "COMPRA" as const, costo: 10_000_000, estadoOperacionOrigen: null };
  it("cuenta autos propios en stock", () => {
    expect(cuentaEnPatrimonio(base)).toBe(true);
    expect(cuentaEnPatrimonio({ ...base, estado: "POR_INGRESAR" })).toBe(true);
    expect(cuentaEnPatrimonio({ ...base, estado: "VENDIDO" })).toBe(false);
    expect(cuentaEnPatrimonio({ ...base, estado: "BAJA" })).toBe(false);
  });
  it("no cuenta consignaciones", () => {
    expect(cuentaEnPatrimonio({ ...base, tipoIngreso: "CONSIGNACION" })).toBe(false);
  });
  it("la permuta cuenta recién al cerrar la venta que la trajo", () => {
    const permuta = { ...base, tipoIngreso: "PERMUTA" as const, estado: "POR_INGRESAR" };
    expect(cuentaEnPatrimonio({ ...permuta, estadoOperacionOrigen: "SENIADA" })).toBe(false);
    expect(cuentaEnPatrimonio({ ...permuta, estadoOperacionOrigen: "CERRADA" })).toBe(true);
    expect(cuentaEnPatrimonio({ ...permuta, estadoOperacionOrigen: null })).toBe(true); // permuta histórica cargada a mano
  });
  it("suma el valor del stock", () => {
    expect(valorStock([base, { ...base, costo: 5_000_000 }, { ...base, tipoIngreso: "CONSIGNACION" }])).toBe(15_000_000);
  });
});

describe("categorías manuales", () => {
  it("solo algunas se cargan a mano", () => {
    expect(esManual("GASTO_SALON")).toBe(true);
    expect(esManual("TRANSFERENCIA_INTERNA")).toBe(true);
    expect(esManual("COBRO_VENTA")).toBe(false);
    expect(esManual("PAGO_INVERSOR")).toBe(false);
  });
});
