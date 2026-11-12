import { describe, it, expect } from "vitest";
import { conSaldoAcumulado, faltaDeFondos, cuentaEnPatrimonio, esManual, filtrarDetalle, resumenPorCategoria, saldos, valorStock } from "./caja";

describe("detalle de un saldo", () => {
  const movs = [
    { sentido: "INGRESO" as const, medio: "EFECTIVO" as const, importe: 1_000_000, anulado: false, categoria: "INGRESO_EXTRAORDINARIO" },
    { sentido: "EGRESO" as const, medio: "EFECTIVO" as const, importe: 200_000, anulado: false, categoria: "GASTO_VEHICULO" },
    { sentido: "EGRESO" as const, medio: "EFECTIVO" as const, importe: 999_999, anulado: true, categoria: "GASTO_SALON" },
    { sentido: "EGRESO" as const, medio: "EFECTIVO" as const, importe: 50_000.5, anulado: false, categoria: "GASTO_VEHICULO" },
  ];

  it("acumula el saldo movimiento a movimiento y termina en el saldo de la tarjeta", () => {
    const filas = conSaldoAcumulado(movs);
    expect(filas.map((f) => f.saldo)).toEqual([1_000_000, 800_000, 800_000, 749_999.5]);
    expect(filas.at(-1)!.saldo).toBe(saldos(movs).efectivo);
  });

  it("filtra por fecha, tipo, concepto y rango de importe", () => {
    const fechados = movs.map((m, i) => ({ ...m, fecha: new Date(`2026-10-0${i + 1}T12:00:00`), concepto: ["Caja inicial", "Gestoría Peugeot", "Luz", "Alistaje"][i] }));
    const ids = (f: Parameters<typeof filtrarDetalle>[1]) => filtrarDetalle(fechados, f).map((m) => m.concepto);
    expect(ids({ desde: new Date("2026-10-02T00:00:00"), hasta: new Date("2026-10-03T23:59:59") })).toEqual(["Gestoría Peugeot", "Luz"]);
    expect(ids({ categoria: "GASTO_VEHICULO" })).toEqual(["Gestoría Peugeot", "Alistaje"]);
    expect(ids({ q: "gestoria" })).toEqual(["Gestoría Peugeot"]);
    expect(ids({ min: 100_000, max: 500_000 })).toEqual(["Gestoría Peugeot"]);
    expect(ids({})).toHaveLength(4);
  });

  it("agrupa por tipo sin contar anulados", () => {
    expect(resumenPorCategoria(movs)).toEqual([
      { categoria: "INGRESO_EXTRAORDINARIO", ingresos: 1_000_000, egresos: 0, cantidad: 1, neto: 1_000_000 },
      { categoria: "GASTO_VEHICULO", ingresos: 0, egresos: 250_000.5, cantidad: 2, neto: -250_000.5 },
    ]);
  });
});

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

  it("el capital del inversor es el valor de compra de sus autos, sin los gastos", () => {
    const auto = { valorCompraArs: 10_000_000, tipoIngreso: "COMPRA" as const, financista: "INVERSOR" as const };
    expect(capitalDelInversor(auto)).toBe(10_000_000);
    expect(capitalDelInversor({ ...auto, financista: "SALON" })).toBe(0);
    // Un usado tomado en parte de pago de un auto suyo también es capital suyo, al valor de toma.
    expect(capitalDelInversor({ ...auto, tipoIngreso: "PERMUTA" })).toBe(10_000_000);
    // La consignación no es de nadie del salón.
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

describe("saldos nunca negativos (K13)", () => {
  const f = (efectivo: number, banco: number, ajena = 0) => ({ efectivo, banco, ajena });
  it("acepta saldos en cero o más", () => {
    expect(faltaDeFondos(f(100, 10), f(0, 10))).toBeNull();
  });
  it("frena si el efectivo queda negativo y sugiere el pase desde el banco", () => {
    expect(faltaDeFondos(f(100, 1000), f(-500, 1000))).toMatch(/efectivo.*Banco → Efectivo/);
  });
  it("frena si el banco queda negativo", () => {
    expect(faltaDeFondos(f(1000, 0), f(1000, -1))).toMatch(/banco/);
  });
  it("frena si la caja del salón queda negativa aunque haya plata (es de inversores)", () => {
    // Hay 1.000 en el banco, pero 800 son del inversor: el salón tiene 200.
    expect(faltaDeFondos(f(0, 1000, 800), f(0, 700, 800))).toMatch(/plata del salón en el banco/);
    expect(faltaDeFondos(f(0, 1000, 800), f(0, 800, 800))).toBeNull();
  });
  it("no frena lo que no empeora un saldo que ya venía negativo (pagarle al inversor)", () => {
    expect(faltaDeFondos(f(0, 1000, 1500), f(0, 500, 1000))).toBeNull();
    expect(faltaDeFondos(f(-50, 1000), f(-50, 900))).toBeNull();
    // Al anular un ingreso no se sugiere cambiar de medio: no hay medio para elegir.
    const anular = faltaDeFondos(f(100, 1000), f(-500, 1000), undefined, true)!;
    expect(anular).toMatch(/No se puede anular.*efectivo/);
    expect(anular).not.toMatch(/elegí/);
    expect(faltaDeFondos(f(100, 1000), f(50, 1000), undefined, true)).toBeNull();
  });
});

import { balanceDelSalon } from "./caja";

describe("balance del salón en el mes", () => {
  it("el resultado es la diferencia entre las dos fotos, sin contar lo que se llevaron ni lo que pusieron los socios", () => {
    // Arrancó con 10 M, ganó 3 M en ventas, gastó 0,5 M y pagó 0,3 M de sueldos: generó 2,2 M.
    // Los socios se llevaron 1 M y pusieron 0,2 M, así que terminó con 11,4 M.
    const b = balanceDelSalon({ inicio: 10_000_000, fin: 11_400_000, ganancia: 3_000_000, gastos: 500_000, sueldosEmpleados: 300_000, retirosSocios: 1_000_000, aportes: 200_000 });
    expect(b.resultado).toBe(2_200_000);
    expect(b.otros).toBe(0);
  });
  it("lo que no se explica va a 'otros' (por ejemplo una seña cobrada de una venta abierta)", () => {
    const b = balanceDelSalon({ inicio: 0, fin: 600_000, ganancia: 0, gastos: 0, sueldosEmpleados: 0, retirosSocios: 0, aportes: 0 });
    expect(b.otros).toBe(600_000);
  });
});

import { medioSugerido } from "./caja";

describe("medio sugerido para pagar (K14)", () => {
  it("efectivo cuando alcanza: es como opera el salón", () => {
    expect(medioSugerido({ efectivo: 5_000_000, banco: 1_000_000 }, 3_000_000)).toBe("EFECTIVO");
    expect(medioSugerido({ efectivo: 3_000_000, banco: 0 }, 3_000_000)).toBe("EFECTIVO"); // justo
  });

  it("banco cuando el efectivo no alcanza", () => {
    expect(medioSugerido({ efectivo: 1_000_000, banco: 50_000_000 }, 3_000_000)).toBe("BANCO");
  });

  it("el caso real: efectivo en rojo y la plata en el banco", () => {
    expect(medioSugerido({ efectivo: -144_107_201.52, banco: 151_600_000 }, 16_500_000)).toBe("BANCO");
  });

  it("si no alcanza en ninguno, el que está menos mal", () => {
    expect(medioSugerido({ efectivo: -10_000_000, banco: 500_000 }, 3_000_000)).toBe("BANCO");
    expect(medioSugerido({ efectivo: 500_000, banco: -10_000_000 }, 3_000_000)).toBe("EFECTIVO");
  });

  it("un reintegro entra, así que no hay nada que cubrir", () => {
    expect(medioSugerido({ efectivo: -144_000_000, banco: 0 }, -500_000)).toBe("EFECTIVO");
  });

  it("sugiere el medio que K13 acepta, y el otro lo habría rechazado", () => {
    // La sugerencia y la validación tienen que estar de acuerdo, si no el que paga se come un
    // error y tiene que adivinar. El efectivo no alcanza pero el banco sí, y al salón le sobra.
    const fondos = { efectivo: -10_000_000, banco: 100_000_000, ajena: 0 };
    const importe = 16_500_000;
    expect(medioSugerido(fondos, importe)).toBe("BANCO");
    expect(faltaDeFondos(fondos, { ...fondos, banco: fondos.banco - importe })).toBeNull();
    expect(faltaDeFondos(fondos, { ...fondos, efectivo: fondos.efectivo - importe })).toContain("No alcanza el efectivo");
  });

  it("si lo que falta es la plata del salón, ningún medio salva: eso lo decide K13", () => {
    // Los saldos reales de hoy: entre los dos medios hay $ 7.492.798, así que pagar 16,5 M se
    // rechaza se elija lo que se elija. medioSugerido no promete que el pago vaya a entrar.
    const fondos = { efectivo: -144_107_201.52, banco: 151_600_000, ajena: 0 };
    expect(medioSugerido(fondos, 16_500_000)).toBe("BANCO");
    expect(faltaDeFondos(fondos, { ...fondos, banco: fondos.banco - 16_500_000 })).toContain("No alcanza la plata del salón");
  });
});

import { deudaConConsignante, efectoCambioFinancista, gastosDelDueno } from "./caja";

describe("quién paga cada gasto del auto (R8)", () => {
  const gastos = [
    { importe: 100_000, extraordinario: false, pagadoPor: "SALON" as const },
    { importe: 250_000, extraordinario: false, pagadoPor: "DUENO" as const },
    { importe: 40_000, extraordinario: true, pagadoPor: "DUENO" as const },
  ];

  it("al dueño solo se le cuentan los gastos que pagó él, sin los extraordinarios", () => {
    expect(gastosDelDueno(gastos)).toBe(250_000);
  });

  it("los gastos del inversor suman a su capital; los del salón no", () => {
    const auto = { tipoIngreso: "COMPRA" as const, financista: "INVERSOR" as const, valorCompraArs: 10_000_000 };
    expect(capitalDelInversor({ ...auto, gastosDelDueno: gastosDelDueno(gastos) })).toBe(10_250_000);
    expect(capitalDelInversor({ ...auto, financista: "SALON", gastosDelDueno: 250_000 })).toBe(0);
  });

  it("al consignante se le debe lo pactado más lo que puso en gastos", () => {
    expect(deudaConConsignante(8_000_000, 250_000)).toBe(8_250_000);
  });
});

describe("cambio de quién financia (K15)", () => {
  const base = { puesto: 16_500_000, permutaPendiente: false, correccion: false };

  it("del salón a un inversor: el inversor le devuelve al salón lo que puso", () => {
    expect(efectoCambioFinancista({ ...base, de: "SALON", a: "INVERSOR" })).toEqual({ sentido: "INGRESO", importe: 16_500_000 });
  });

  it("de un inversor al salón: el salón le devuelve el capital al inversor", () => {
    expect(efectoCambioFinancista({ ...base, de: "INVERSOR", a: "SALON" })).toEqual({ sentido: "EGRESO", importe: 16_500_000 });
  });

  it("entre inversores, una corrección o una permuta de una venta abierta no mueven la caja", () => {
    expect(efectoCambioFinancista({ ...base, de: "INVERSOR", a: "INVERSOR" })).toBeNull();
    expect(efectoCambioFinancista({ ...base, de: "SALON", a: "INVERSOR", correccion: true })).toBeNull();
    expect(efectoCambioFinancista({ ...base, de: "SALON", a: "INVERSOR", permutaPendiente: true })).toBeNull();
    expect(efectoCambioFinancista({ ...base, puesto: 0, de: "SALON", a: "INVERSOR" })).toBeNull();
  });
});

import { pagoAlInversor } from "./caja";

describe("cómo se le paga al inversor lo de una venta (K10, R3)", () => {
  it("con ganancia: devolución de capital y pago de ganancia por separado", () => {
    expect(pagoAlInversor(10_000_000, 750_000).map((m) => [m.categoria, m.importe])).toEqual([
      ["DEVOLUCION_CAPITAL", 10_000_000],
      ["PAGO_INVERSOR", 750_000],
    ]);
  });

  it("con pérdida: un solo pago por el capital menos su mitad de la pérdida", () => {
    expect(pagoAlInversor(10_000_000, -700_000)).toEqual([{ sentido: "EGRESO", categoria: "DEVOLUCION_CAPITAL", importe: 9_300_000, salda: ["CAPITAL", "GANANCIA"] }]);
  });

  it("si la pérdida supera el capital, el inversor reintegra la diferencia", () => {
    expect(pagoAlInversor(1_000_000, -1_500_000)).toEqual([{ sentido: "INGRESO", categoria: "REINTEGRO_INVERSOR", importe: 500_000, salda: ["CAPITAL", "GANANCIA"] }]);
    expect(pagoAlInversor(-2_000_000, 300_000)[0]).toMatchObject({ sentido: "INGRESO", categoria: "REINTEGRO_INVERSOR", importe: 1_700_000 });
  });

  it("si se compensan justo no se mueve plata", () => {
    expect(pagoAlInversor(700_000, -700_000)).toEqual([]);
  });
});
