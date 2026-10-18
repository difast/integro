import "server-only";
import nodemailer from "nodemailer";
import { company } from "@/config/company";

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string[];
};

/**
 * Конфигурация SMTP из переменных окружения. null — отправка не настроена.
 * Получатели — MAIL_TO; если переменная не задана, письма идут на почту компании
 * из src/config/company.ts, а при её отсутствии — на адрес SMTP_USER.
 */
export function getMailConfig(): MailConfig | null {
  const env = process.env;
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;

  const listed = (env.MAIL_TO ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const to = listed.length > 0 ? listed : [company.contacts.email ?? user];

  const port = Number(env.SMTP_PORT ?? 465);
  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user,
    password,
    from: env.MAIL_FROM?.trim() || user,
    to,
  };
}

export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

export async function sendMail(message: { subject: string; text: string; replyTo?: string }) {
  const config = getMailConfig();
  if (!config) throw new Error("SMTP is not configured");

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({
    from: config.from,
    to: config.to,
    subject: message.subject,
    text: message.text,
    replyTo: message.replyTo,
  });
}
