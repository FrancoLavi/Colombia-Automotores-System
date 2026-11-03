import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { prepararBase } from "@/test/db";
import type { Mail } from "@/lib/mail";
import { cambiarPassword } from "./configuracion";
import { cerrarTodasLasSesiones, linkDeRecuperacion, pedirRecuperacion, restablecerPassword, verificarCredenciales } from "./seguridad";

beforeAll(prepararBase);

const EMAIL = "seguridad@local.test";
let id = 0;
const usuario = async () => (await db.query.usuarios.findFirst({ where: eq(s.usuarios.id, id) }))!;

beforeAll(async () => {
  const [u] = await db.insert(s.usuarios).values({ nombre: "Ana", email: EMAIL, passwordHash: await bcrypt.hash("clave-vieja-1", 10) }).returning();
  id = u.id;
});

/** Captura los mails en vez de mandarlos y devuelve el token del link. */
function buzon() {
  const recibidos: Mail[] = [];
  const enviar = async (m: Mail) => void recibidos.push(m);
  const token = () => new URL(/https?:\/\/\S+/.exec(recibidos.at(-1)!.texto)![0]).searchParams.get("token")!;
  return { recibidos, enviar, token };
}

describe("T4 · ingreso y bloqueo", () => {
  it("ingresa sin importar mayúsculas en el mail y no revela si el mail existe", async () => {
    expect((await verificarCredenciales("  Seguridad@Local.TEST ", "clave-vieja-1")).id).toBe(id);
    await expect(verificarCredenciales("nadie@local.test", "x")).rejects.toThrow("Mail o contraseña incorrectos.");
  });

  it("bloquea 15 minutos al quinto intento fallido, aunque después pongan bien la clave", async () => {
    const t0 = new Date("2026-11-03T12:00:00Z");
    for (let i = 0; i < 5; i++) await expect(verificarCredenciales(EMAIL, "mal", t0)).rejects.toThrow("Mail o contraseña incorrectos.");
    await expect(verificarCredenciales(EMAIL, "clave-vieja-1", new Date("2026-11-03T12:05:00Z"))).rejects.toThrow(/Probá de nuevo en 10 minutos/);
    // Pasado el bloqueo, entra y se limpia el contador.
    await verificarCredenciales(EMAIL, "clave-vieja-1", new Date("2026-11-03T12:16:00Z"));
    expect(await usuario()).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
  });
});

describe("T4 · recuperar contraseña por mail", () => {
  it("manda un link que sirve una sola vez, cambia la clave y cierra las sesiones", async () => {
    const b = buzon();
    const versionAntes = (await usuario()).versionSesion;
    await pedirRecuperacion("SEGURIDAD@local.test", b.enviar);
    expect(b.recibidos).toHaveLength(1);
    expect(b.recibidos[0]).toMatchObject({ para: EMAIL, asunto: expect.stringMatching(/Recuperar/) });
    expect(b.recibidos[0].texto).toContain("/login/restablecer?token=");

    // En la base queda solo el hash, no el token.
    const guardado = await db.select().from(s.recuperaciones).where(eq(s.recuperaciones.usuarioId, id));
    expect(guardado.some((r) => r.tokenHash === b.token())).toBe(false);

    expect(await linkDeRecuperacion(b.token())).toEqual({ nombre: "Ana" });
    await expect(restablecerPassword(b.token(), "nueva-clave-1", "otra-cosa")).rejects.toThrow(/no coinciden/);
    await restablecerPassword(b.token(), "nueva-clave-1", "nueva-clave-1");
    expect((await usuario()).versionSesion).toBe(versionAntes + 1);
    await expect(verificarCredenciales(EMAIL, "clave-vieja-1")).rejects.toThrow();
    expect((await verificarCredenciales(EMAIL, "nueva-clave-1")).id).toBe(id);

    // El mismo link no sirve dos veces.
    expect(await linkDeRecuperacion(b.token())).toBeNull();
    await expect(restablecerPassword(b.token(), "otra-clave-22", "otra-clave-22")).rejects.toThrow(/venció o ya se usó/);
  });

  it("el link vence a los 30 minutos", async () => {
    const b = buzon();
    const t0 = new Date(Date.now() - 2 * 60 * 60_000); // hace 2 h: no cuenta para el límite por hora
    await pedirRecuperacion(EMAIL, b.enviar, t0);
    expect(await linkDeRecuperacion(b.token(), new Date(t0.getTime() + 29 * 60_000))).not.toBeNull();
    expect(await linkDeRecuperacion(b.token(), new Date(t0.getTime() + 31 * 60_000))).toBeNull();
  });

  it("no manda nada a mails sin usuario y como mucho 3 por hora", async () => {
    const b = buzon();
    await pedirRecuperacion("nadie@local.test", b.enviar);
    expect(b.recibidos).toHaveLength(0);
    // Ya hubo 1 en la última hora (el primer test): entran 2 más y después corta.
    for (let i = 0; i < 4; i++) await pedirRecuperacion(EMAIL, b.enviar);
    expect(b.recibidos).toHaveLength(2);
  });

  it("pedir el link desbloquea al restablecer", async () => {
    await db.update(s.usuarios).set({ bloqueadoHasta: new Date(Date.now() + 10 * 60_000) }).where(eq(s.usuarios.id, id));
    await db.delete(s.recuperaciones).where(eq(s.recuperaciones.usuarioId, id));
    const b = buzon();
    await pedirRecuperacion(EMAIL, b.enviar);
    await restablecerPassword(b.token(), "desbloqueada-1", "desbloqueada-1");
    expect((await verificarCredenciales(EMAIL, "desbloqueada-1")).id).toBe(id);
  });
});

describe("T4 · cerrar sesiones", () => {
  it("cambiar la contraseña y 'cerrar en todos los dispositivos' suben la versión de sesión", async () => {
    const v0 = (await usuario()).versionSesion;
    const u = await cambiarPassword(id, id, "cambiada-123", "desbloqueada-1");
    expect(u.versionSesion).toBe(v0 + 1);
    await cerrarTodasLasSesiones(id);
    expect((await usuario()).versionSesion).toBe(v0 + 2);
    await expect(cambiarPassword(id, id, "corta")).rejects.toThrow(/al menos 8/);
  });
});
