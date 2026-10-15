import { describe, it, expect } from "vitest";
import { interpretarDescripcion, interpretarImporte, normalizarDominio } from "./importar";

describe("descripciones de la planilla", () => {
  it.each([
    ["FORD KA SE", { marca: "Ford", modelo: "Ka", version: "SE" }],
    ["                AMAROK HIGHLINE 4X4 AT", { marca: "Volkswagen", modelo: "Amarok", version: "HIGHLINE 4X4 AT" }],
    ["AMROK COMFORTLINE 4X2 AUT", { marca: "Volkswagen", modelo: "Amarok", version: "COMFORTLINE 4X2 AUT" }],
    ["Volkswagen HIGH UP", { marca: "Volkswagen", modelo: "High Up", version: null }],
    ["ECO SPORT TITANIUM 2,0 MT", { marca: "Ford", modelo: "Eco Sport", version: "TITANIUM 2,0 MT" }],
    ["2008 ALLURE ", { marca: "Peugeot", modelo: "2008", version: "ALLURE" }],
    ["DUSTER OROCH DYNAMIQUE 1,6", { marca: "Renault", modelo: "Duster Oroch", version: "DYNAMIQUE 1,6" }],
    ["RENAULT KANGOO FURGON 1.6 GNC", { marca: "Renault", modelo: "Kangoo", version: "FURGON 1.6 GNC" }],
    ["CHERY TIGGO II 2.0", { marca: "Chery", modelo: "Tiggo", version: "II 2.0" }],
    ["MARCA DESCONOCIDA X", { marca: null, modelo: "Marca", version: "DESCONOCIDA X" }],
  ])("%s", (desc, esperado) => {
    expect(interpretarDescripcion(desc)).toEqual(esperado);
  });
});

describe("importes y patentes", () => {
  it("precios escritos como texto", () => {
    expect(interpretarImporte("          $16.500.000")).toBe(16_500_000);
    expect(interpretarImporte("$ 1.234,50")).toBe(1234.5);
    expect(interpretarImporte(17333)).toBe(17333);
    expect(interpretarImporte("")).toBeNull();
    expect(interpretarImporte(null)).toBeNull();
  });
  it("patentes", () => {
    expect(normalizarDominio("ab 123 cd")).toBe("AB123CD");
    expect(normalizarDominio("AE-908-RT")).toBe("AE908RT");
    expect(normalizarDominio("")).toBeNull();
  });
});
