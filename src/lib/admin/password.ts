import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Пароль администратора берётся только из переменной окружения ADMIN_PASSWORD
 * на сервере. Он не хранится в базе, не попадает в клиентский код и ответы.
 */

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export type AdminPasswordStatus = "ok" | "missing" | "too_short";

export function adminPasswordStatus(value = process.env.ADMIN_PASSWORD): AdminPasswordStatus {
  if (!value || value.trim() === "") return "missing";
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) return "too_short";
  return "ok";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Сравнение за постоянное время. Хеши одинаковой длины позволяют не раскрывать
 * длину пароля через время ответа. Если пароль не настроен — всегда false.
 */
export function verifyAdminPassword(input: string, expected = process.env.ADMIN_PASSWORD): boolean {
  if (adminPasswordStatus(expected) !== "ok" || typeof input !== "string") return false;
  return timingSafeEqual(digest(input), digest(expected as string));
}
