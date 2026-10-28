import { beforeAll, describe, expect, it } from "vitest";
import { prepararBase } from "@/test/db";
import { autoDisponible, baseContacto, U } from "@/test/fabricas";
import * as con from "./contactos";
import * as ven from "./ventas";
import { buscarGlobal } from "./buscar";

beforeAll(prepararBase);

describe("búsqueda global (Ctrl+K)", () => {
  let auto = 0;
  let op = 0;
  let cliente = 0;

  beforeAll(async () => {
    auto = await autoDisponible("AB123CD", { marca: "Volkswagen", modelo: "Amarok" });
    cliente = await con.crearContacto(U, { ...baseContacto, nombre: "Lucía", apellido: "Gómez", telefono: "2915550199" });
    op = await ven.crearOperacion(U, { contactoId: cliente, vehiculoId: auto, precioVenta: 30_000_000, observaciones: null });
  });

  it("encuentra el auto por patente aunque se escriba con espacios o en minúscula", async () => {
    const r = await buscarGlobal("ab 123");
    expect(r).toContainEqual(expect.objectContaining({ tipo: "auto", href: `/stock/${auto}`, titulo: "Volkswagen Amarok 2019" }));
  });

  it("encuentra el contacto por nombre y apellido o por teléfono con otro formato", async () => {
    expect(await buscarGlobal("lucía góm")).toContainEqual(expect.objectContaining({ tipo: "contacto", href: `/contactos/${cliente}` }));
    expect(await buscarGlobal("lucia gomez")).toContainEqual(expect.objectContaining({ tipo: "contacto", href: `/contactos/${cliente}` }));
    expect(await buscarGlobal("Gomez Lucia")).toContainEqual(expect.objectContaining({ tipo: "contacto", href: `/contactos/${cliente}` }));
    expect(await buscarGlobal("0291 15 555-0199")).toContainEqual(expect.objectContaining({ tipo: "contacto", href: `/contactos/${cliente}` }));
  });

  it("encuentra la venta por número, cliente o modelo", async () => {
    const venta = expect.objectContaining({ tipo: "venta", href: `/ventas/${op}` });
    expect(await buscarGlobal(`V-${String(op).padStart(4, "0")}`)).toContainEqual(venta);
    expect(await buscarGlobal("Gómez")).toContainEqual(venta);
    expect(await buscarGlobal("amarok")).toContainEqual(venta);
  });

  it("no busca con menos de 2 letras", async () => {
    expect(await buscarGlobal("a")).toEqual([]);
  });
});
