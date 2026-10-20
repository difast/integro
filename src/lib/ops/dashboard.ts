import "server-only";
import { query } from "@/lib/db";

/** Данные раздела «Система и интеграции» — только из базы, без обращений к внешним API. */

export type StatusRow = { key: string; lastOkAt: Date | null; lastErrorAt: Date | null; lastError: string | null; details: Record<string, unknown> | null };

export async function getIntegrationStatuses(): Promise<Record<string, StatusRow>> {
  const rows = await query<{ key: string; last_ok_at: Date | null; last_error_at: Date | null; last_error: string | null; details: Record<string, unknown> | null }>(
    "SELECT key, last_ok_at, last_error_at, last_error, details FROM integration_status",
  );
  return Object.fromEntries(rows.map((r) => [r.key, { key: r.key, lastOkAt: r.last_ok_at, lastErrorAt: r.last_error_at, lastError: r.last_error, details: r.details }]));
}

export type ChannelHealth = {
  lastEventAt: Date | null;
  errors: number;
  duplicates: number;
  failedSends: number;
  unknownSends: number;
  pendingSends: number;
  failedEvents: number;
  retryingEvents: number;
};

export async function getChannelHealth(channel: "max" | "telegram", days: number): Promise<ChannelHealth> {
  const [events, journal, sends] = await Promise.all([
    query<{ last_event: Date | null; failed: string; retrying: string }>(
      `SELECT max(received_at) AS last_event,
         count(*) FILTER (WHERE status = 'failed' AND attempts >= 5) AS failed,
         count(*) FILTER (WHERE status IN ('failed', 'pending') AND attempts BETWEEN 1 AND 4) AS retrying
       FROM chat_events WHERE channel = $1`,
      [channel],
    ),
    query<{ errors: string; duplicates: string }>(
      `SELECT count(*) FILTER (WHERE result IN ('error', 'failed', 'retry')) AS errors, count(*) FILTER (WHERE result = 'duplicate') AS duplicates
       FROM system_events WHERE channel = $1 AND created_at >= now() - make_interval(days => $2)`,
      [channel, days],
    ),
    query<{ failed: string; unknown: string; pending: string }>(
      `SELECT count(*) FILTER (WHERE m.status = 'failed') AS failed, count(*) FILTER (WHERE m.status = 'unknown') AS unknown,
         count(*) FILTER (WHERE m.status IN ('pending', 'sending')) AS pending
       FROM chat_messages m JOIN chat_clients c ON c.id = m.client_id
       WHERE c.channel = $1 AND m.direction = 'out' AND m.created_at >= now() - make_interval(days => $2)`,
      [channel, days],
    ),
  ]);
  return {
    lastEventAt: events[0]?.last_event ?? null,
    errors: Number(journal[0]?.errors ?? 0),
    duplicates: Number(journal[0]?.duplicates ?? 0),
    failedSends: Number(sends[0]?.failed ?? 0),
    unknownSends: Number(sends[0]?.unknown ?? 0),
    pendingSends: Number(sends[0]?.pending ?? 0),
    failedEvents: Number(events[0]?.failed ?? 0),
    retryingEvents: Number(events[0]?.retrying ?? 0),
  };
}

export type NotificationHealth = { pushSubscriptions: number; telegramRecipients: number; pending: number; failed: number; sent: number };

export async function getNotificationHealth(days: number): Promise<NotificationHealth> {
  const [subs, recipients, deliveries] = await Promise.all([
    query<{ count: string }>("SELECT count(*) AS count FROM push_subscriptions"),
    query<{ count: string }>("SELECT count(*) AS count FROM notification_recipients WHERE active"),
    query<{ pending: string; failed: string; sent: string }>(
      `SELECT count(*) FILTER (WHERE d.status IN ('pending', 'sending')) AS pending, count(*) FILTER (WHERE d.status = 'failed') AS failed,
         count(*) FILTER (WHERE d.status = 'sent') AS sent
       FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE n.created_at >= now() - make_interval(days => $1)`,
      [days],
    ),
  ]);
  return {
    pushSubscriptions: Number(subs[0]?.count ?? 0),
    telegramRecipients: Number(recipients[0]?.count ?? 0),
    pending: Number(deliveries[0]?.pending ?? 0),
    failed: Number(deliveries[0]?.failed ?? 0),
    sent: Number(deliveries[0]?.sent ?? 0),
  };
}

export type FailedOperation = { kind: "event" | "delivery"; id: string; channel: string; title: string; error: string | null; at: Date };

/** Неуспешные операции, которые можно безопасно повторить: события (транзакционная обработка) и доставки уведомлений. */
export async function listFailedOperations(limit = 20): Promise<FailedOperation[]> {
  const [events, deliveries] = await Promise.all([
    query<{ id: string; channel: string; update_type: string; error: string | null; received_at: Date }>(
      `SELECT id, channel, update_type, error, received_at FROM chat_events WHERE status = 'failed' AND attempts >= 5 AND payload IS NOT NULL
       ORDER BY id DESC LIMIT ${limit}`,
    ),
    query<{ id: string; transport: string; error: string | null; created_at: Date; title: string }>(
      `SELECT d.id, d.transport, d.error, n.created_at, n.title FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id
       WHERE d.status = 'failed' ORDER BY d.id DESC LIMIT ${limit}`,
    ),
  ]);
  return [
    ...events.map((e) => ({ kind: "event" as const, id: String(e.id), channel: e.channel, title: `Событие ${e.update_type}`, error: e.error, at: e.received_at })),
    ...deliveries.map((d) => ({ kind: "delivery" as const, id: String(d.id), channel: d.transport === "push" ? "push" : "telegram_admin", title: `Уведомление: ${d.title}`, error: d.error, at: d.created_at })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Повтор обработки события после исчерпания попыток (обработка транзакционна и идемпотентна). */
export async function resetFailedEvent(id: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false;
  const rows = await query<{ id: string }>(
    "UPDATE chat_events SET status = 'pending', attempts = 0, next_attempt_at = NULL, error = NULL WHERE id = $1 AND status = 'failed' AND payload IS NOT NULL RETURNING id",
    [id],
  );
  return rows.length > 0;
}

export type JournalFilters = { channel: string; result: string; operation: string; days: number; page: number; q: string };
export type JournalRow = { id: string; createdAt: Date; channel: string; operation: string; result: string; ref: string | null; message: string };
export const JOURNAL_PAGE = 50;

export async function listJournal(filters: JournalFilters): Promise<{ items: JournalRow[]; total: number }> {
  const parts = ["created_at >= now() - make_interval(days => $1)"];
  const params: unknown[] = [filters.days];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    parts.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.channel) add("channel = ?", filters.channel);
  if (filters.result) add("result = ?", filters.result);
  if (filters.operation) add("operation = ?", filters.operation);
  if (filters.q) add("lower(message) LIKE ?", `%${filters.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const where = `WHERE ${parts.join(" AND ")}`;
  const offset = (filters.page - 1) * JOURNAL_PAGE;
  const [rows, count] = await Promise.all([
    query<{ id: string; created_at: Date; channel: string; operation: string; result: string; ref: string | null; message: string }>(
      `SELECT id, created_at, channel, operation, result, ref, message FROM system_events ${where} ORDER BY id DESC LIMIT ${JOURNAL_PAGE} OFFSET ${offset}`,
      params,
    ),
    query<{ count: string }>(`SELECT count(*) AS count FROM system_events ${where}`, params),
  ]);
  return {
    items: rows.map((r) => ({ id: String(r.id), createdAt: r.created_at, channel: r.channel, operation: r.operation, result: r.result, ref: r.ref, message: r.message })),
    total: Number(count[0]?.count ?? 0),
  };
}
