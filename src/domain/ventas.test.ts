import { describe, it, expect } from "vitest";
import { faltantesParaCerrar, numeroOperacion, seCobraAlRegistrar, validarPagoNuevo } from "./ventas";

describe("operación de venta", () => {
  it("numera las operaciones", () => {
    expect(numeroOperacion(42)).toBe("V-0042");
  });

  it("no deja cargar pagos por encima del precio", () => {
    const pagos = [{ tipo: "SENIA" as const, importe: 300_000, estado: "COBRADO" as const }];
    expect(validarPagoNuevo(10_000_000, pagos, 9_700_000)).toBeNull();
    expect(validarPagoNuevo(10_000_000, pagos, 9_800_000)).toMatch(/Supera el precio/);
    expect(validarPagoNuevo(10_000_000, pagos, 0)).toMatch(/mayor a cero/);
  });

  it("las señas devueltas no cuentan para la cobertura", () => {
    const pagos = [{ tipo: "SENIA" as const, importe: 300_000, estado: "DEVUELTA" as const }];
    expect(validarPagoNuevo(10_000_000, pagos, 10_000_000)).toBeNull();
  });

  it("se cierra solo con el 100 % cubierto y el auto disponible o reservado", () => {
    const completo = [
      { tipo: "SENIA" as const, importe: 300_000, estado: "COBRADO" as const },
      { tipo: "CREDITO" as const, importe: 5_700_000, estado: "PENDIENTE" as const },
      { tipo: "PERMUTA" as const, importe: 4_000_000, estado: "PENDIENTE" as const },
    ];
    expect(faltantesParaCerrar("SENIADA", 10_000_000, completo, "RESERVADO")).toEqual([]);
    expect(faltantesParaCerrar("PREVENTA", 10_000_000, completo.slice(0, 2), "DISPONIBLE")).toEqual(["Faltan cubrir $ 4.000.000"]);
    expect(faltantesParaCerrar("CERRADA", 10_000_000, completo, "VENDIDO")).toHaveLength(2);
  });

  it("qué pagos entran a caja al registrarlos", () => {
    expect(seCobraAlRegistrar("SENIA", false)).toBe(true);
    expect(seCobraAlRegistrar("EFECTIVO", true)).toBe(true);
    expect(seCobraAlRegistrar("EFECTIVO", false)).toBe(false);
    expect(seCobraAlRegistrar("CREDITO", true)).toBe(false);
    expect(seCobraAlRegistrar("PERMUTA", true)).toBe(false);
  });
});
