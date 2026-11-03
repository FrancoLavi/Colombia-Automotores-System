import "server-only";
import nodemailer from "nodemailer";

export interface Mail {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/**
 * Manda un mail por SMTP. Sirve con una casilla de Gmail (smtp.gmail.com + contraseña de aplicación)
 * o con cualquier proveedor que dé SMTP (Resend, Brevo…), cambiando solo las variables SMTP_*.
 * Sin SMTP_HOST o SMTP_PASS (desarrollo y tests) no manda nada: lo muestra en la consola del servidor.
 */
export async function enviarMail(m: Mail): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_PASS) {
    console.info(`[mail sin enviar: falta configurar SMTP_HOST / SMTP_PASS]\nPara: ${m.para}\nAsunto: ${m.asunto}\n\n${m.texto}`);
    return;
  }
  const puerto = Number(process.env.SMTP_PORT || 465);
  const transporte = nodemailer.createTransport({
    host,
    port: puerto,
    // 465 va cifrado de entrada; 587 arranca en claro y pasa a cifrado (STARTTLS).
    secure: puerto === 465,
    // Google muestra la contraseña de aplicación en grupos ("abcd efgh …"): los espacios no son parte de la clave.
    auth: { user: process.env.SMTP_USER, pass: host === "smtp.gmail.com" ? process.env.SMTP_PASS.replace(/\s+/g, "") : process.env.SMTP_PASS },
  });
  await transporte.sendMail({
    from: process.env.MAIL_FROM || `Colombia Automotores <${process.env.SMTP_USER}>`,
    to: m.para,
    subject: m.asunto,
    text: m.texto,
    html: m.html,
  });
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
