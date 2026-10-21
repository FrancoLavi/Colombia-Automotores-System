import { describe, it, expect } from "vitest";
import { alarmaEntrega, desdeArgentina, diaArgentina, diasParaEntrega, horaArgentina, pendientesParaEntregar, semanasDelMes } from "./entregas";

const ar = (dia: number, hora = "12:00") => desdeArgentina(`2026-10-${String(dia).padStart(2, "0")}`, hora);
const hoy = ar(21, "10:00");
const listo = { estadoOperacion: "CERRADA" as const, faltaCubrir: 0, aCobrar: 0, papelesFaltantes: 0, estadoAuto: "VENDIDO" };

describe("alarma de entrega (3 días antes)", () => {
  it("no avisa con más de 3 días", () => {
    expect(alarmaEntrega(ar(25, "16:00"), listo, hoy)).toBeNull();
  });
  it("avisa 3 días antes; si está todo listo es aviso", () => {
    expect(alarmaEntrega(ar(24, "16:00"), listo, hoy)).toEqual({ severidad: "AVISO", dias: 3, texto: "Entrega en 3 días · todo listo" });
  });
  it("si falta algo es crítica y lo detalla", () => {
    const a = alarmaEntrega(ar(22, "09:00"), { ...listo, estadoOperacion: "SENIADA", faltaCubrir: 2_000_000, papelesFaltantes: 2 }, hoy);
    expect(a).toMatchObject({ severidad: "CRITICA", dias: 1 });
    expect(a!.texto).toBe("Entrega mañana: la venta no está cerrada, faltan cubrir $ 2.000.000, faltan 2 papeles");
  });
  it("atrasada y entregada", () => {
    expect(alarmaEntrega(ar(19), listo, hoy)!.texto).toBe("Entrega atrasada 2 días · todo listo");
    expect(alarmaEntrega(ar(21), { ...listo, estadoOperacion: "ENTREGADA" }, hoy)).toBeNull();
    expect(alarmaEntrega(null, listo, hoy)).toBeNull();
  });
  it("días y pendientes", () => {
    expect(diasParaEntrega(ar(21, "23:00"), hoy)).toBe(0);
    expect(pendientesParaEntregar({ ...listo, aCobrar: 8_000_000, estadoAuto: "POR_INGRESAR" })).toEqual(["quedan $ 8.000.000 a cobrar", "el auto todavía está por ingresar"]);
  });
});

describe("calendario", () => {
  it("arma las semanas de lunes a domingo", () => {
    const s = semanasDelMes(2026, 10); // octubre 2026 arranca jueves
    expect(s[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(s.flat().filter(Boolean)).toHaveLength(31);
    expect(s.every((w) => w.length === 7)).toBe(true);
  });
});

describe("hora argentina", () => {
  it("el día y la hora no dependen del huso del servidor", () => {
    const d = desdeArgentina("2026-10-24", "22:30"); // 01:30 UTC del 25
    expect(d.toISOString()).toBe("2026-10-25T01:30:00.000Z");
    expect(diaArgentina(d)).toBe("2026-10-24");
    expect(horaArgentina(d)).toBe("22:30");
    expect(diasParaEntrega(d, ar(21, "23:59"))).toBe(3);
  });
});
