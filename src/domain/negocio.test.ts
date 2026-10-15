import { describe, it, expect } from "vitest";
import { costoTotal, precioSugerido, compraEnPesos, liquidar, margenUsd, cobertura, patrimonio, diasEnStock } from "./negocio";

describe("costo y precio", () => {
  it("suma compra y gastos, sin los extraordinarios", () => {
    expect(costoTotal(10_000_000, [
      { importe: 600_000, extraordinario: false },
      { importe: 400_000, extraordinario: false },
      { importe: 90_000, extraordinario: true },
    ])).toBe(11_000_000);
  });

  it("precio sugerido = costo + 15 % + ajuste", () => {
    expect(precioSugerido(11_000_000)).toBe(12_650_000);
    expect(precioSugerido(11_000_000, 250_000)).toBe(12_900_000);
  });

  it("convierte compra en USD con el blue fijado", () => {
    // Logan del Excel: USD 8.910 a 1.515
    expect(compraEnPesos(8_910, "USD", 1_515)).toEqual({ ars: 13_498_650, usd: 8_910 });
    expect(compraEnPesos(15_000_000, "ARS", 1_500)).toEqual({ ars: 15_000_000, usd: 10_000 });
    expect(() => compraEnPesos(1, "USD", 0)).toThrow();
  });
});

describe("reparto (R3/R4)", () => {
  it("inversor: ganancia ≥ 15 % → 7,5 % al inversor, resto al salón", () => {
    const l = liquidar({ costo: 11_000_000, precio: 12_900_000, financista: "INVERSOR", tipoIngreso: "COMPRA" });
    expect(l.regla).toBe("INVERSOR_BASE");
    expect(l.parteInversor).toBe(825_000);
    expect(l.parteSalon).toBe(1_075_000);
    expect(l.sobreprecio).toBe(250_000);
  });

  it("caso del Excel (Gol 2017): costo 13,5 M, venta 16 M", () => {
    const l = liquidar({ costo: 13_500_000, precio: 16_000_000, financista: "INVERSOR", tipoIngreso: "PERMUTA" });
    expect(l.parteInversor).toBe(1_012_500);
    expect(l.parteSalon).toBe(1_487_500);
    expect(l.parteInversor + l.parteSalon).toBe(l.ganancia);
  });

  it("inversor: ganancia < 15 % → mitad y mitad (ejemplo de los socios: 10 M → 10,5 M)", () => {
    const l = liquidar({ costo: 10_000_000, precio: 10_500_000, financista: "INVERSOR", tipoIngreso: "COMPRA" });
    expect(l.regla).toBe("INVERSOR_MITADES");
    expect(l.parteInversor).toBe(250_000);
    expect(l.parteSalon).toBe(250_000);
  });

  it("venta con pérdida → mitad y mitad de la pérdida", () => {
    const l = liquidar({ costo: 10_000_000, precio: 9_600_000, financista: "INVERSOR", tipoIngreso: "COMPRA" });
    expect(l.parteInversor).toBe(-200_000);
    expect(l.parteSalon).toBe(-200_000);
  });

  it("financia el salón → 100 % salón", () => {
    const l = liquidar({ costo: 21_470_000, precio: 24_000_000, financista: "SALON", tipoIngreso: "COMPRA" });
    expect(l.regla).toBe("SALON_TOTAL");
    expect(l.parteSalon).toBe(2_530_000);
    expect(l.parteInversor).toBe(0);
  });

  it("consignación → 100 % salón aunque figure un inversor", () => {
    const l = liquidar({ costo: 8_000_000, precio: 9_000_000, financista: "INVERSOR", tipoIngreso: "CONSIGNACION" });
    expect(l.parteSalon).toBe(1_000_000);
    expect(l.parteInversor).toBe(0);
  });
});

describe("margen en USD (R5)", () => {
  it("alerta cuando baja al 10 %", () => {
    const ok = margenUsd(12_650_000, 11_000_000, 1_500, 1_500);
    expect(ok.margen).toBeCloseTo(0.15, 5);
    expect(ok.alerta).toBe(false);
    const subio = margenUsd(12_650_000, 11_000_000, 1_500, 1_570);
    expect(subio.margen).toBeLessThanOrEqual(0.1);
    expect(subio.alerta).toBe(true);
  });
});

describe("cobertura de la venta (S5)", () => {
  it("separa caja, a cobrar y permuta; ignora señas devueltas", () => {
    const c = cobertura(10_000_000, [
      { tipo: "SENIA", importe: 300_000, estado: "COBRADO" },
      { tipo: "EFECTIVO", importe: 2_700_000, estado: "PENDIENTE" },
      { tipo: "CREDITO", importe: 3_000_000, estado: "PENDIENTE" },
      { tipo: "PERMUTA", importe: 4_000_000, estado: "PENDIENTE" },
      { tipo: "SENIA", importe: 100_000, estado: "DEVUELTA" },
    ]);
    expect(c).toEqual({ caja: 3_000_000, aCobrar: 3_000_000, permuta: 4_000_000, cubierto: 10_000_000, faltante: 0, completo: true });
  });
});

describe("patrimonio y días", () => {
  it("patrimonio = caja + stock + a cobrar − a pagar", () => {
    expect(patrimonio({ caja: 36_780_000, stockAlCosto: 368_000_000, aCobrar: 9_000_000, aPagar: 1_780_000 })).toBe(412_000_000);
  });
  it("días en stock desde la fecha de disponible", () => {
    expect(diasEnStock("2026-09-01", "2026-09-06", new Date(2026, 9, 14))).toBe(38);
    expect(diasEnStock("2026-10-14", null, new Date(2026, 9, 14))).toBe(0);
  });
});
