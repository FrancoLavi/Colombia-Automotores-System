import { describe, expect, it } from "vitest";
import { accionesPosibles, alarmaValor, problemaCambio, resumenCartera, sePuedeDepositar, vencimiento, type EstadoValor } from "./valores";

const HOY = "2026-11-17";
const cheque = (fechaPago: string, estado: EstadoValor = "EN_CARTERA", importe = 1_000_000) => ({ estado, fechaPago, importe });

describe("T7 · vencimiento de un cheque", () => {
  it("cuenta los 30 días desde la fecha de pago, no desde la emisión", () => {
    expect(vencimiento("2026-11-17")).toBe("2026-12-17");
    expect(vencimiento("2026-12-31")).toBe("2027-01-30");
  });

  it("marca vencido recién pasados los 30 días de la fecha de pago", () => {
    expect(alarmaValor(cheque("2026-10-18"), HOY)).toBe("POR_VENCER"); // último día para presentarlo
    expect(alarmaValor(cheque("2026-10-17"), HOY)).toBe("VENCIDO"); // día 31
  });

  it("avisa cuando quedan pocos días de plazo, que es lo que apura a tesorería", () => {
    expect(alarmaValor(cheque("2026-12-30"), HOY)).toBe("AL_DIA"); // faltan meses
    expect(alarmaValor(cheque("2026-10-23"), HOY)).toBe("POR_VENCER"); // quedan 5 días
    expect(alarmaValor(cheque("2026-10-24"), HOY)).toBe("AL_DIA"); // quedan 6
  });

  it("un rechazado se muestra como rechazado aunque esté en fecha", () => {
    expect(alarmaValor(cheque("2026-12-01", "RECHAZADO"), HOY)).toBe("RECHAZADO");
  });

  it("un valor ya cerrado no vence: su plata ya se resolvió", () => {
    expect(alarmaValor(cheque("2020-01-01", "ACREDITADO"), HOY)).toBe("AL_DIA");
    expect(alarmaValor(cheque("2020-01-01", "ENDOSADO"), HOY)).toBe("AL_DIA");
  });
});

describe("T7 · cuándo se puede depositar", () => {
  it("no antes de la fecha de pago", () => {
    expect(sePuedeDepositar(cheque("2026-11-18"), HOY)).toBe(false);
    expect(sePuedeDepositar(cheque("2026-11-17"), HOY)).toBe(true);
  });

  it("no después del plazo, ni si no está en cartera", () => {
    expect(sePuedeDepositar(cheque("2026-10-17"), HOY)).toBe(false);
    expect(sePuedeDepositar(cheque("2026-11-01", "DEPOSITADO"), HOY)).toBe(false);
  });
});

describe("T7 · qué se puede hacer con cada valor", () => {
  it("en cartera se deposita, se endosa, rebota o se pierde", () => {
    expect(accionesPosibles("EN_CARTERA")).toEqual(["DEPOSITADO", "ENDOSADO", "RECHAZADO", "INCOBRABLE"]);
  });

  it("depositado solo puede acreditar o rebotar", () => {
    expect(accionesPosibles("DEPOSITADO")).toEqual(["ACREDITADO", "RECHAZADO"]);
  });

  it("un rechazado se puede volver a intentar o dar por perdido", () => {
    expect(accionesPosibles("RECHAZADO")).toEqual(["EN_CARTERA", "INCOBRABLE"]);
  });

  it("los cerrados no admiten nada", () => {
    for (const e of ["ACREDITADO", "ENDOSADO", "INCOBRABLE"] as const) expect(accionesPosibles(e)).toEqual([]);
  });

  it("explica por qué no se puede, en vez de fallar sin más", () => {
    expect(problemaCambio("EN_CARTERA", "EN_CARTERA")).toMatch(/ya está en cartera/);
    expect(problemaCambio("ACREDITADO", "ENDOSADO")).toMatch(/acreditado ya no se puede cambiar/);
    expect(problemaCambio("DEPOSITADO", "ENDOSADO")).toMatch(/No se puede pasar/);
    expect(problemaCambio("EN_CARTERA", "DEPOSITADO")).toBeNull();
  });
});

describe("T7 · resumen de la cartera", () => {
  it("suma solo lo que todavía se puede cobrar", () => {
    const r = resumenCartera(
      [
        cheque("2026-12-01", "EN_CARTERA", 1_000_000),
        cheque("2026-11-01", "DEPOSITADO", 500_000),
        cheque("2026-10-01", "EN_CARTERA", 300_000), // vencido, pero sigue valiendo
        cheque("2026-11-10", "RECHAZADO", 200_000),
        cheque("2026-09-01", "ACREDITADO", 900_000), // ya entró a la caja
        cheque("2026-09-01", "ENDOSADO", 700_000), // ya pagó una deuda
        cheque("2026-09-01", "INCOBRABLE", 400_000), // ya se perdió
      ],
      HOY,
    );
    expect(r.enCartera).toBe(1_300_000);
    expect(r.depositados).toBe(500_000);
    expect(r.rechazados).toBe(200_000);
    expect(r.vencidos).toBe(300_000);
    // Lo acreditado, lo endosado y lo incobrable no suman: su plata ya se resolvió en otro lado.
    expect(r.total).toBe(2_000_000);
  });
});
