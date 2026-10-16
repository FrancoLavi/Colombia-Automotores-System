import { describe, it, expect } from "vitest";
import { avance, objetivoUnidades, rotacion, rotacionPorModelo, ventasPorMes } from "./dashboard";
import { margenUsd } from "./negocio";

describe("objetivo del mes", () => {
  it("usa el cargado o, si no hay, la mitad del stock", () => {
    expect(objetivoUnidades(12, 24)).toEqual({ valor: 12, automatico: false });
    expect(objetivoUnidades(null, 23)).toEqual({ valor: 12, automatico: true });
    expect(objetivoUnidades(undefined, 0)).toEqual({ valor: 1, automatico: true });
  });
  it("avance y rotación", () => {
    expect(avance(7, 12)).toBeCloseTo(0.583, 3);
    expect(avance(15, 12)).toBe(1);
    expect(rotacion(7, 24)).toBe(0.29);
  });
});

describe("ventas de los últimos 12 meses", () => {
  it("agrupa por mes y descarta lo viejo", () => {
    const m = ventasPorMes(["2026-10-01", "2026-10-15", "2026-09-30", "2025-10-31", "2025-11-01"], new Date(2026, 9, 16));
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ periodo: "2025-11", ventas: 1, etiqueta: "Nov 25" });
    expect(m[10]).toMatchObject({ periodo: "2026-09", ventas: 1 });
    expect(m[11]).toMatchObject({ periodo: "2026-10", ventas: 2 });
  });
});

describe("rotación por modelo", () => {
  it("promedia días y ordena de más rápido a más lento", () => {
    expect(
      rotacionPorModelo([
        { marca: "Peugeot", modelo: "208", dias: 48 },
        { marca: "VW", modelo: "Amarok", dias: 10 },
        { marca: "VW", modelo: "Amarok", dias: 14 },
      ]),
    ).toEqual([
      { modelo: "VW Amarok", dias: 12, ventas: 2 },
      { modelo: "Peugeot 208", dias: 48, ventas: 1 },
    ]);
  });
});

describe("umbral de margen configurable", () => {
  it("la alerta respeta el umbral recibido", () => {
    expect(margenUsd(12_650_000, 11_000_000, 1_500, 1_570).alerta).toBe(true);
    expect(margenUsd(12_650_000, 11_000_000, 1_500, 1_570, 0.05).alerta).toBe(false);
  });
});
