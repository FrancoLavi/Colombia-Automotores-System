import { describe, expect, it } from "vitest";
import { coincideAuto, hayFiltroAuto, leerFiltroAuto, opcionesAuto } from "./autos";

const ranger = { marca: "Ford", modelo: "Ranger", dominio: "AC456EF" };
const c4 = { marca: "Citroën", modelo: "C4 Cactus", dominio: null };

describe("filtro de autos por marca, modelo y patente", () => {
  it("sin filtro pasa todo, incluso lo que no tiene auto", () => {
    expect(coincideAuto(null, {})).toBe(true);
    expect(hayFiltroAuto(leerFiltroAuto({ marca: "  ", q: "x" }))).toBe(false);
  });
  it("cada campo busca por 'contiene', sin tildes ni mayúsculas", () => {
    expect(coincideAuto(ranger, { marca: "ford", modelo: "rang" })).toBe(true);
    expect(coincideAuto(c4, { marca: "citroen" })).toBe(true);
    expect(coincideAuto(ranger, { modelo: "hilux" })).toBe(false);
  });
  it("la patente se compara sin espacios ni guiones", () => {
    expect(coincideAuto(ranger, { patente: "ac 456" })).toBe(true);
    expect(coincideAuto(ranger, { patente: "AC-456-EF" })).toBe(true);
    expect(coincideAuto(c4, { patente: "AC" })).toBe(false);
  });
  it("con filtro, lo que no tiene auto no pasa", () => {
    expect(coincideAuto(null, { marca: "Ford" })).toBe(false);
  });
  it("arma las opciones de marca y modelo sin repetir", () => {
    expect(opcionesAuto([ranger, c4, ranger, null])).toEqual({ marcas: ["Citroën", "Ford"], modelos: ["C4 Cactus", "Ranger"] });
  });
});
