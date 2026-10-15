import { describe, it, expect } from "vitest";
import { faltantesParaHabilitar, transicionesManuales, alertasVehiculo, type DocumentoEstado } from "./stock";

const docs = (over: Partial<Record<string, DocumentoEstado["estado"]>> = {}): DocumentoEstado[] =>
  [
    { nombre: "Título", obligatorio: true },
    { nombre: "VTV", obligatorio: true },
    { nombre: "Duplicado de llaves", obligatorio: false },
  ].map((d) => ({ ...d, estado: over[d.nombre] ?? "RECIBIDO", fechaVencimiento: null }));

describe("habilitar para la venta (V3)", () => {
  it("se puede con papeles obligatorios y peritaje apto", () => {
    expect(faltantesParaHabilitar("POR_INGRESAR", docs({ "Duplicado de llaves": "PENDIENTE" }), { resultado: "APTO" })).toEqual([]);
  });
  it("informa cada faltante", () => {
    expect(faltantesParaHabilitar("POR_INGRESAR", docs({ VTV: "PENDIENTE" }), null)).toEqual(["Falta: VTV", "Falta el peritaje"]);
    expect(faltantesParaHabilitar("POR_INGRESAR", docs(), { resultado: "NO_APTO" })).toEqual(["El peritaje dio NO APTO"]);
  });
  it("NO_APLICA cuenta como resuelto", () => {
    expect(faltantesParaHabilitar("POR_INGRESAR", docs({ VTV: "NO_APLICA" }), { resultado: "APTO_CON_OBS" })).toEqual([]);
  });
  it("solo desde POR_INGRESAR", () => {
    expect(faltantesParaHabilitar("DISPONIBLE", docs(), { resultado: "APTO" })).toHaveLength(1);
  });
});

describe("transiciones manuales", () => {
  it("reservar, vender y entregar no se hacen a mano", () => {
    expect(transicionesManuales("DISPONIBLE")).toEqual(["BAJA"]);
    expect(transicionesManuales("RESERVADO")).toEqual([]);
    expect(transicionesManuales("POR_INGRESAR")).toContain("RECHAZADO");
  });
});

describe("alertas de stock", () => {
  const hoy = new Date(2026, 9, 15);
  const base = { estado: "DISPONIBLE" as const, fechaIngreso: "2026-08-01", fechaDisponible: "2026-08-10", costo: 11_000_000, precio: 12_650_000, tcIngreso: 1_500 };

  it("días en stock: aviso a 30, crítica a 60", () => {
    expect(alertasVehiculo({ ...base, fechaDisponible: "2026-09-10" }, docs(), null, undefined, hoy)[0]).toMatchObject({ severidad: "AVISO" });
    expect(alertasVehiculo(base, docs(), null, undefined, hoy)[0]).toMatchObject({ tipo: "DIAS_STOCK", severidad: "CRITICA" });
  });

  it("vencimiento próximo y vencido", () => {
    const d: DocumentoEstado[] = [
      { nombre: "VTV", obligatorio: true, estado: "RECIBIDO", fechaVencimiento: "2026-10-20" },
      { nombre: "Verificación policial", obligatorio: true, estado: "RECIBIDO", fechaVencimiento: "2026-10-01" },
    ];
    const a = alertasVehiculo({ ...base, fechaDisponible: "2026-10-14" }, d, null, undefined, hoy);
    expect(a.map((x) => x.texto)).toEqual(["VTV vence en 5 días", "Verificación policial vencida"]);
  });

  it("margen USD ≤ 10 % con el dólar de hoy", () => {
    const a = alertasVehiculo({ ...base, fechaDisponible: "2026-10-14" }, docs(), 1_570, undefined, hoy);
    expect(a.some((x) => x.tipo === "MARGEN_USD")).toBe(true);
  });

  it("costo sin cargar (stock importado incompleto)", () => {
    const a = alertasVehiculo({ ...base, costo: 0, fechaDisponible: "2026-10-14" }, docs(), 1_500, undefined, hoy);
    expect(a).toEqual([{ tipo: "DATOS_INCOMPLETOS", severidad: "AVISO", texto: "Costo sin cargar" }]);
  });

  it("autos vendidos no generan alertas", () => {
    expect(alertasVehiculo({ ...base, estado: "VENDIDO" }, docs(), 2_000, undefined, hoy)).toEqual([]);
  });
});
