import { describe, it, expect } from "vitest";
import { leerNumero } from "./form";

describe("importes con puntos de miles", () => {
  it("1.500 son mil quinientos, no 1,5", () => {
    expect(leerNumero("1.500")).toBe(1500);
    expect(leerNumero("26.599.740")).toBe(26_599_740);
    expect(leerNumero("1.234,50")).toBe(1234.5);
    expect(leerNumero("-500.000")).toBe(-500_000);
    expect(leerNumero("1460")).toBe(1460);
  });
  it("un punto que no separa miles es decimal", () => {
    expect(leerNumero("7.5")).toBe(7.5);
    expect(leerNumero("1460.25")).toBe(1460.25);
    expect(leerNumero("7,5")).toBe(7.5);
  });
});
