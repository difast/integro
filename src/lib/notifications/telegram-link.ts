import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { telegramApi } from "@/lib/telegram/api";
import { getTelegramConfig } from "@/lib/telegram/config";

/**
 * Привязка Telegram-аккаунта сотрудника к служебным уведомлениям.
 * 1. В админке создаётся одноразовый код (живёт 15 минут, в базе — только его SHA-256).
 * 2. Сотрудник открывает ссылку t.me/<бот>?start=admin_<код> и нажимает «Старт».
 * 3. Бот получает /start admin_<код>, проверяет код и сохраняет чат как получателя.
 * Без действующего кода чат получателем стать не может; карточка клиента для такого /start не создаётся.
 */

export const ADMIN_LINK_PREFIX = "admin_";
const TTL_MINUTES = 15;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

async function botUsername(): Promise<string | null> {
  const configured = getTelegramConfig().username;
  if (configured) return configured;
  const me = await telegramApi.getMe();
  return me.username ?? null;
}

export async function createTelegramLink(): Promise<{ url: string; expiresInMinutes: number }> {
  const username = await botUsername();
  if (!username) throw new Error("Не удалось определить username бота: задайте TELEGRAM_BOT_USERNAME.");
  const code = randomBytes(16).toString("hex");
  await query("DELETE FROM admin_link_codes WHERE expires_at < now() OR used_at IS NOT NULL");
  await query(`INSERT INTO admin_link_codes (code_hash, expires_at) VALUES ($1, now() + make_interval(mins => $2))`, [hash(code), TTL_MINUTES]);
  return { url: `https://t.me/${username}?start=${ADMIN_LINK_PREFIX}${code}`, expiresInMinutes: TTL_MINUTES };
}

/** Проверка кода из /start внутри транзакции обработки события. */
export async function consumeTelegramLink(db: Pick<PoolClient, "query">, code: string, chatId: number, displayName: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(code)) return false;
  const { rows } = await db.query<{ code_hash: string }>(
    "UPDATE admin_link_codes SET used_at = now() WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING code_hash",
    [hash(code)],
  );
  if (!rows[0]) return false;
  await db.query(
    `INSERT INTO notification_recipients (transport, chat_id, display_name) VALUES ('telegram', $1, $2)
     ON CONFLICT (transport, chat_id) DO UPDATE SET active = true, display_name = EXCLUDED.display_name`,
    [chatId, displayName.slice(0, 200)],
  );
  return true;
}

export type Recipient = { id: string; chatId: string; displayName: string; active: boolean; createdAt: Date };

export async function listRecipients(): Promise<Recipient[]> {
  const rows = await query<{ id: string; chat_id: string; display_name: string; active: boolean; created_at: Date }>(
    "SELECT id, chat_id, display_name, active, created_at FROM notification_recipients ORDER BY id",
  );
  return rows.map((r) => ({ id: String(r.id), chatId: String(r.chat_id), displayName: r.display_name, active: r.active, createdAt: r.created_at }));
}

export async function removeRecipient(id: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false;
  const rows = await query<{ id: string }>("DELETE FROM notification_recipients WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}
