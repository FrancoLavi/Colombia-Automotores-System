import { describe, expect, it } from "vitest";
import {
  estadoSesion,
  INACTIVIDAD_S,
  minutosBloqueado,
  problemaPassword,
  registrarFallo,
  RENOVAR_CADA_S,
  rutaDeVuelta,
  TOPE_SESION_S,
  vencimientoSesion,
} from "./seguridad";

const H = 3600;

describe("T4 · sesión", () => {
  const ini = 1_000_000;
  it("se renueva mientras se usa y vence tras 8 h sin uso", () => {
    expect(estadoSesion({ ini, iat: ini }, ini + 60)).toBe("VIGENTE");
    expect(estadoSesion({ ini, iat: ini }, ini + RENOVAR_CADA_S)).toBe("RENOVAR");
    expect(estadoSesion({ ini, iat: ini }, ini + INACTIVIDAD_S)).toBe("VENCIDA");
  });
  it("tiene un tope de 7 días aunque se use todo el tiempo", () => {
    const ultimoUso = ini + TOPE_SESION_S - 60;
    expect(estadoSesion({ ini, iat: ultimoUso }, ultimoUso + 30)).toBe("VIGENTE");
    expect(estadoSesion({ ini, iat: ultimoUso }, ini + TOPE_SESION_S)).toBe("VENCIDA");
  });
  it("el vencimiento del token no se pasa del tope", () => {
    expect(vencimientoSesion(ini, ini + H)).toBe(ini + H + INACTIVIDAD_S);
    expect(vencimientoSesion(ini, ini + TOPE_SESION_S - H)).toBe(ini + TOPE_SESION_S);
  });
});

describe("T4 · intentos fallidos", () => {
  const ahora = new Date("2026-11-03T12:00:00Z");
  it("bloquea 15 minutos al quinto intento", () => {
    expect(registrarFallo(0, ahora)).toEqual({ intentos: 1, bloqueadoHasta: null });
    const r = registrarFallo(4, ahora);
    expect(r.intentos).toBe(0);
    expect(r.bloqueadoHasta?.toISOString()).toBe("2026-11-03T12:15:00.000Z");
    expect(minutosBloqueado(r.bloqueadoHasta, new Date("2026-11-03T12:05:30Z"))).toBe(10);
    expect(minutosBloqueado(r.bloqueadoHasta, new Date("2026-11-03T12:15:00Z"))).toBe(0);
  });
});

describe("T4 · contraseñas y redirección", () => {
  it("valida largo y repetición", () => {
    expect(problemaPassword("corta")).toMatch(/al menos 8/);
    expect(problemaPassword("larga-123", "larga-124")).toMatch(/no coinciden/);
    expect(problemaPassword("larga-123", "larga-123")).toBeNull();
  });
  it("solo vuelve a rutas internas", () => {
    expect(rutaDeVuelta("/ventas/12")).toBe("/ventas/12");
    expect(rutaDeVuelta("//malicioso.com")).toBeNull();
    expect(rutaDeVuelta("https://malicioso.com")).toBeNull();
    expect(rutaDeVuelta("/login")).toBeNull();
    expect(rutaDeVuelta(null)).toBeNull();
  });
});
