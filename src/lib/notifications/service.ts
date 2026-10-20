import "server-only";
import type { PoolClient } from "pg";
import { describeDbError, query } from "@/lib/db";
import { getNotificationSettings, type NotificationType } from "@/lib/ops/settings";

/**
 * Создание уведомления: одна запись на событие (уникальный dedupe_key — повторное событие не создаёт
 * дубль) и строки доставки по включённым каналам (push — каждой подписке, Telegram — каждому
 * привязанному получателю). Отправка — deliverPendingNotifications() после фиксации транзакции.
 */

export type NewNotification = {
  type: NotificationType;
  channel: string;
  title: string;
  body?: string;
  link?: string | null;
  dedupeKey: string;
};

type Executor = Pick<PoolClient, "query">;

async function run<T extends Record<string, unknown>>(db: Executor | undefined, sql: string, params: unknown[]): Promise<T[]> {
  return db ? (await db.query<T>(sql, params)).rows : query<T>(sql, params);
}

/** Возвращает id созданного уведомления или null (уже было / сбой — сбой не прерывает основную операцию). */
export async function notify(input: NewNotification, db?: Executor): Promise<string | null> {
  try {
    const inserted = await run<{ id: string }>(
      db,
      `INSERT INTO notifications (type, channel, title, body, link, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
      [input.type, input.channel.slice(0, 20), input.title.slice(0, 200), (input.body ?? "").slice(0, 500), input.link ?? null, input.dedupeKey.slice(0, 200)],
    );
    const id = inserted[0]?.id;
    if (!id) return null;

    const settings = await getNotificationSettings();
    if (settings.transports.push.includes(input.type)) {
      await run(db, `INSERT INTO notification_deliveries (notification_id, transport, target_id) SELECT $1, 'push', id FROM push_subscriptions ON CONFLICT DO NOTHING`, [id]);
    }
    if (settings.transports.telegram.includes(input.type)) {
      await run(
        db,
        `INSERT INTO notification_deliveries (notification_id, transport, target_id)
         SELECT $1, 'telegram', id FROM notification_recipients WHERE active ON CONFLICT DO NOTHING`,
        [id],
      );
    }
    return String(id);
  } catch (error) {
    console.error("[notify] failed to create notification:", describeDbError(error));
    if (db) throw error; // внутри транзакции ошибку нельзя скрыть — транзакция всё равно прервана
    return null;
  }
}

/** Ключ «не чаще одного раза за N минут» для повторяющихся событий (новые сообщения в одном диалоге). */
export async function throttledKey(prefix: string, now = Date.now()): Promise<string> {
  const minutes = (await getNotificationSettings()).messageThrottleMinutes;
  return `${prefix}:${Math.floor(now / (minutes * 60_000))}`;
}

// --- Центр уведомлений ---

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  channel: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
};

type Row = { id: string; type: NotificationType; channel: string; title: string; body: string; link: string | null; created_at: Date; read_at: Date | null };
const toRecord = (row: Row): NotificationRecord => ({
  id: String(row.id),
  type: row.type,
  channel: row.channel,
  title: row.title,
  body: row.body,
  link: row.link,
  createdAt: row.created_at,
  readAt: row.read_at,
});

export const NOTIFICATIONS_PAGE = 30;

export async function listNotifications(filters: { type?: string; status?: "unread" | "read" | ""; page?: number }): Promise<{ items: NotificationRecord[]; total: number }> {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (filters.type) {
    params.push(filters.type);
    parts.push(`type = $${params.length}`);
  }
  if (filters.status === "unread") parts.push("read_at IS NULL");
  if (filters.status === "read") parts.push("read_at IS NOT NULL");
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  const offset = (Math.max(1, filters.page ?? 1) - 1) * NOTIFICATIONS_PAGE;
  const [rows, count] = await Promise.all([
    query<Row>(`SELECT id, type, channel, title, body, link, created_at, read_at FROM notifications ${where} ORDER BY id DESC LIMIT ${NOTIFICATIONS_PAGE} OFFSET ${offset}`, params),
    query<{ count: string }>(`SELECT count(*) AS count FROM notifications ${where}`, params),
  ]);
  return { items: rows.map(toRecord), total: Number(count[0]?.count ?? 0) };
}

export async function notificationSummary(): Promise<{ unread: number; latest: NotificationRecord[]; lastId: string | null }> {
  const [count, rows] = await Promise.all([
    query<{ count: string }>("SELECT count(*) AS count FROM notifications WHERE read_at IS NULL"),
    query<Row>("SELECT id, type, channel, title, body, link, created_at, read_at FROM notifications ORDER BY id DESC LIMIT 8"),
  ]);
  return { unread: Number(count[0]?.count ?? 0), latest: rows.map(toRecord), lastId: rows[0] ? String(rows[0].id) : null };
}

export async function markNotificationsRead(ids: string[] | "all"): Promise<number> {
  if (ids === "all") {
    const rows = await query<{ id: string }>("UPDATE notifications SET read_at = now() WHERE read_at IS NULL RETURNING id");
    return rows.length;
  }
  const clean = ids.filter((id) => /^\d{1,18}$/.test(id));
  if (!clean.length) return 0;
  const rows = await query<{ id: string }>("UPDATE notifications SET read_at = now() WHERE id = ANY($1::bigint[]) AND read_at IS NULL RETURNING id", [clean]);
  return rows.length;
}
