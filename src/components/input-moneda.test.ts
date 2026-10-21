import { describe, it, expect } from "vitest";
import { conMiles, textoMoneda } from "./input-moneda";

describe("puntos de miles al escribir", () => {
  it("formatea mientras se escribe", () => {
    expect(conMiles("1500000")).toBe("1.500.000");
    expect(conMiles("1.500.0001")).toBe("15.000.001");
    expect(conMiles("1234,567")).toBe("1.234,56");
    expect(conMiles("00012")).toBe("12");
    expect(conMiles("-500000")).toBe("500.000");
    expect(conMiles("-500000", true)).toBe("-500.000");
  });
  it("texto inicial desde un número", () => {
    expect(textoMoneda(1460.5)).toBe("1.460,5");
    expect(textoMoneda(26599740)).toBe("26.599.740");
    expect(textoMoneda(null)).toBe("");
  });
});
