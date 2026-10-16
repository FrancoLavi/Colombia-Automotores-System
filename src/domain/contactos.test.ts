import { describe, it, expect } from "vitest";
import { coincidePedido, describirPedido, etapasManuales, linkWhatsapp, normalizarTelefono } from "./contactos";

describe("teléfonos", () => {
  it.each([
    ["291 555-0142", "2915550142"],
    ["+54 9 291 15-555-0142", "2915550142"],
    ["0291 15 5550142", "2915550142"],
    ["11 4444-5555", "1144445555"],
    ["", null],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });
  it("arma el link de WhatsApp", () => {
    expect(linkWhatsapp("291 555-0142")).toBe("https://wa.me/5492915550142");
    expect(linkWhatsapp("123")).toBeNull();
  });
});

describe("pedidos contra stock", () => {
  const amarok = { marca: "Volkswagen", modelo: "Amarok", version: "V6 Highline", anio: 2019, precio: 32_900_000 };
  const vacio = { marca: null, modelo: null, anioDesde: null, anioHasta: null, presupuestoMax: null };

  it("un pedido vacío coincide con todo", () => {
    expect(coincidePedido(vacio, amarok)).toBe(true);
  });
  it("marca y modelo sin importar mayúsculas ni acentos; modelo busca también en la versión", () => {
    expect(coincidePedido({ ...vacio, marca: "volkswagen", modelo: "amarok v6" }, amarok)).toBe(true);
    expect(coincidePedido({ ...vacio, modelo: "hilux" }, amarok)).toBe(false);
    expect(coincidePedido({ ...vacio, marca: "Ford" }, amarok)).toBe(false);
  });
  it("rango de años y presupuesto", () => {
    expect(coincidePedido({ ...vacio, anioDesde: 2017, anioHasta: 2021, presupuestoMax: 35_000_000 }, amarok)).toBe(true);
    expect(coincidePedido({ ...vacio, anioDesde: 2020 }, amarok)).toBe(false);
    expect(coincidePedido({ ...vacio, presupuestoMax: 30_000_000 }, amarok)).toBe(false);
  });
  it("descripción corta", () => {
    expect(describirPedido({ ...vacio, marca: "Volkswagen", modelo: "Amarok", anioDesde: 2017, anioHasta: 2021 })).toBe("Volkswagen Amarok · 2017–2021");
    expect(describirPedido(vacio)).toBe("Cualquier auto");
  });
});

describe("etapas", () => {
  it("solo descartar y reactivar son manuales", () => {
    expect(etapasManuales("DATO")).toEqual(["DESCARTADO"]);
    expect(etapasManuales("DESCARTADO")).toEqual(["DATO"]);
    expect(etapasManuales("PREVENTA")).toEqual([]);
  });
});
