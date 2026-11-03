import "server-only";

export interface Mail {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/**
 * Manda un mail con Resend (https://resend.com) usando su API HTTP, sin SDK.
 * Sin RESEND_API_KEY (desarrollo y tests) no manda nada: lo muestra en la consola del servidor.
 */
export async function enviarMail(m: Mail): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.info(`[mail sin enviar: falta RESEND_API_KEY]\nPara: ${m.para}\nAsunto: ${m.asunto}\n\n${m.texto}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Colombia Automotores <onboarding@resend.dev>",
      to: [m.para],
      subject: m.asunto,
      text: m.texto,
      html: m.html,
    }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
}

/**
 * Dirección pública de la app para armar links en los mails. Sale de la configuración, nunca del
 * encabezado Host del pedido (si no, alguien podría hacer que el link de recuperación apunte a otro sitio).
 */
export function urlApp(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
