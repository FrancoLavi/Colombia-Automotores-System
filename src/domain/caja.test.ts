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

import { formateadorMoneda } from "@/lib/formato";
import { exigePersona } from "./caja";

describe("vista en dólares", () => {
  it("convierte con el blue de hoy solo para mostrar", () => {
    const usd = formateadorMoneda(true, 1_500);
    expect(usd(15_000_000)).toBe("USD 10.000");
    expect(usd(-3_000)).toBe("−USD 2");
    expect(usd(null)).toBe("—");
    expect(formateadorMoneda(false, 1_500)(15_000_000)).toMatch(/15\.000\.000/);
    expect(formateadorMoneda(true, null)(15_000_000)).toMatch(/15\.000\.000/); // sin dólar cargado queda en pesos
  });
  it("el sueldo exige persona", () => {
    expect(exigePersona("SUELDO")).toBe(true);
    expect(exigePersona("RETIRO_SOCIO")).toBe(false);
  });
});

import { cajaDelSalon, capitalDelInversor, compraSaleDeCaja, patrimonioSalon, patrimonioTotal } from "./caja";

describe("la plata del inversor no es del salón (K9–K11)", () => {
  it("la compra sale de caja solo si la financia el salón", () => {
    expect(compraSaleDeCaja({ tipoIngreso: "COMPRA", financista: "SALON" })).toBe(true);
    expect(compraSaleDeCaja({ tipoIngreso: "COMPRA", financista: "INVERSOR" })).toBe(false);
    // La permuta no se paga y la consignación se le paga al dueño recién al vender.
    expect(compraSaleDeCaja({ tipoIngreso: "PERMUTA", financista: "SALON" })).toBe(false);
    expect(compraSaleDeCaja({ tipoIngreso: "CONSIGNACION", financista: "SALON" })).toBe(false);
  });

  it("el capital a devolver es el valor de compra, y solo si el inversor lo compró", () => {
    const auto = { valorCompraArs: 10_000_000, tipoIngreso: "COMPRA" as const, financista: "INVERSOR" as const };
    expect(capitalDelInversor(auto)).toBe(10_000_000);
    expect(capitalDelInversor({ ...auto, financista: "SALON" })).toBe(0);
    // Una permuta o una consignación no le costaron plata al inversor.
    expect(capitalDelInversor({ ...auto, tipoIngreso: "PERMUTA" })).toBe(0);
    expect(capitalDelInversor({ ...auto, tipoIngreso: "CONSIGNACION" })).toBe(0);
  });

  /**
   * El ciclo completo de un auto de inversor, para ver que cierra en cada paso.
   * El salón arranca con 5.000.000. Juan compra un auto en 10.000.000 pagándolo él,
   * el salón le pone 500.000 de gastos y se vende en 13.000.000 (R3: Juan 787.500,
   * salón 1.712.500). El salón tiene que terminar con 5.000.000 + 1.712.500.
   */
  it("el ciclo completo de un auto financiado por un inversor cierra", () => {
    const vacio = { aCobrar: 0, aPagar: 0 };

    const alta = { ...vacio, caja: 5_000_000, stock: 10_000_000, capitalInversores: 10_000_000, deudaInversores: 0 };
    expect(patrimonioTotal(alta)).toBe(15_000_000);
    expect(patrimonioSalon(alta)).toBe(5_000_000); // la compra no le movió nada al salón
    expect(cajaDelSalon(alta.caja, alta.deudaInversores)).toBe(5_000_000);

    // El salón paga 500.000 de gastos: la plata pasa de la caja al auto.
    const conGastos = { ...alta, caja: 4_500_000, stock: 10_500_000 };
    expect(patrimonioTotal(conGastos)).toBe(15_000_000);
    expect(patrimonioSalon(conGastos)).toBe(5_000_000);

    // Se vende en 13.000.000 y se cobra. A Juan se le deben 10.000.000 + 787.500.
    const vendido = { ...vacio, caja: 17_500_000, stock: 0, capitalInversores: 0, deudaInversores: 10_787_500 };
    expect(patrimonioTotal(vendido)).toBe(17_500_000);
    expect(patrimonioSalon(vendido)).toBe(6_712_500);
    expect(cajaDelSalon(vendido.caja, vendido.deudaInversores)).toBe(6_712_500);

    // Se le paga a Juan: la caja baja pero el salón queda igual, porque esa plata no era suya.
    const pagado = { ...vendido, caja: 6_712_500, deudaInversores: 0 };
    expect(patrimonioTotal(pagado)).toBe(6_712_500);
    expect(patrimonioSalon(pagado)).toBe(6_712_500);
    expect(patrimonioSalon(pagado) - patrimonioSalon(alta)).toBe(1_712_500); // su parte de R3
  });

  it("el capital en stock no se descuenta de la caja: está en el auto", () => {
    const p = { caja: 2_000_000, stock: 10_000_000, capitalInversores: 10_000_000, aCobrar: 0, aPagar: 0, deudaInversores: 0 };
    expect(cajaDelSalon(p.caja, p.deudaInversores)).toBe(2_000_000);
    expect(patrimonioSalon(p)).toBe(2_000_000);
  });

  it("las cuentas abiertas suman y restan al total", () => {
    const p = { caja: 1_000_000, stock: 0, capitalInversores: 0, aCobrar: 4_000_000, aPagar: 1_500_000, deudaInversores: 500_000 };
    expect(patrimonioTotal(p)).toBe(3_500_000);
    expect(patrimonioSalon(p)).toBe(3_000_000);
  });
});
