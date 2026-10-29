import { describe, it, expect } from "vitest";
import { fecha, fechaHora, hora, hoyIso } from "./formato";

/**
 * Todo se muestra en hora de Argentina (-03), venga de donde venga el servidor.
 * En desarrollo la máquina ya está en -03 y por eso esto nunca se notó; producción corre en
 * UTC y salía todo tres horas adelantado. CI también corre en UTC, así que estas pruebas
 * fallan ahí si alguien vuelve a formatear una fecha sin fijar la zona.
 */
describe("fechas y horas en hora argentina", () => {
  // 29/10/2026 a las 14:44 en Argentina.
  const tarde = new Date("2026-10-29T17:44:44Z");
  // 29/10/2026 a las 22:30 en Argentina: en UTC ya es el día 30.
  const nocheTarde = new Date("2026-10-30T01:30:00Z");

  it("muestra la hora de Argentina, no la del servidor", () => {
    expect(fechaHora(tarde)).toContain("29/10/26");
    expect(fechaHora(tarde)).toMatch(/\b2:44\b/);
    expect(hora(tarde)).toMatch(/\b2:44\b/);
  });

  it("de noche no adelanta el día", () => {
    expect(fecha(nocheTarde)).toBe("29/10/2026");
    expect(fechaHora(nocheTarde)).toContain("29/10/26");
    expect(hoyIso(nocheTarde)).toBe("2026-10-29");
  });

  it("hoyIso da el día argentino", () => {
    expect(hoyIso(tarde)).toBe("2026-10-29");
    expect(hoyIso(new Date("2026-01-01T02:00:00Z"))).toBe("2025-12-31"); // año nuevo
  });

  it("una fecha sin hora se muestra tal cual, sin correrla de zona", () => {
    expect(fecha("2026-10-14")).toBe("14/10/2026");
    expect(fecha("2026-01-01")).toBe("01/01/2026");
  });

  it("sin fecha muestra un guión", () => {
    expect(fecha(null)).toBe("—");
    expect(fechaHora(null)).toBe("—");
    expect(hora(undefined)).toBe("—");
  });
});
