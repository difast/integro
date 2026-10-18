import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db";

/**
 * Хранилище сессий администратора и попыток входа в PostgreSQL.
 * В базе хранится только SHA-256 от случайного токена сессии: по утечке таблицы
 * войти нельзя. Токен — 32 случайных байта из криптографического генератора Node.js.
 */

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_PER_CLIENT = 5;
export const MAX_FAILED_TOTAL = 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query("INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)", [hashToken(token), expiresAt]);
  // Заодно удаляем истёкшие сессии.
  await query("DELETE FROM admin_sessions WHERE expires_at < now()");
  return { token, expiresAt };
}

export async function isSessionValid(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const rows = await query<{ ok: number }>(
    "SELECT 1 AS ok FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()",
    [hashToken(token)],
  );
  return rows.length > 0;
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM admin_sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function deleteAllSessions(): Promise<void> {
  await query("DELETE FROM admin_sessions");
}

/** IP хранится только в виде хеша и удаляется через сутки. */
export function clientHash(ip: string): string {
  return createHash("sha256").update(`integro-admin-login:${ip}`, "utf8").digest("hex");
}

/**
 * Блокировка входа: не более MAX_FAILED_PER_CLIENT неудачных попыток с одного адреса
 * и MAX_FAILED_TOTAL со всех адресов за LOGIN_WINDOW_MS.
 */
export async function isLoginBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const rows = await query<{ client: string; total: string }>(
    `SELECT count(*) FILTER (WHERE client_hash = $1) AS client, count(*) AS total
     FROM admin_login_attempts WHERE attempted_at > $2`,
    [clientHash(ip), since],
  );
  const client = Number(rows[0]?.client ?? 0);
  const total = Number(rows[0]?.total ?? 0);
  return client >= MAX_FAILED_PER_CLIENT || total >= MAX_FAILED_TOTAL;
}

export async function recordFailedLogin(ip: string): Promise<void> {
  await query("INSERT INTO admin_login_attempts (client_hash) VALUES ($1)", [clientHash(ip)]);
  await query("DELETE FROM admin_login_attempts WHERE attempted_at < now() - interval '1 day'");
}

export async function clearFailedLogins(ip: string): Promise<void> {
  await query("DELETE FROM admin_login_attempts WHERE client_hash = $1", [clientHash(ip)]);
}
