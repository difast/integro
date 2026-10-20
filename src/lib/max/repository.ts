import "server-only";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { isUuid } from "@/lib/requests/repository";
import { buildMaxWhere, MAX_PAGE_SIZE, type MaxFilters } from "./filters";
import { sendOutboxMessage, type SendOutcome } from "./processor";
import type { AttachmentMeta, MaxButton } from "./types";

/** Запросы панели администратора к данным чат-бота MAX. */

export type MaxClientListItem = {
  id: string;
  maxUserId: string;
  firstName: string;
  lastName: string;
  username: string | null;
  phone: string;
  status: "open" | "closed";
  mode: "bot" | "operator";
  needsReply: boolean;
  botBlocked: boolean;
  lastSeenAt: Date;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageDirection: "in" | "out" | null;
  requestCount: number;
};

export type MaxClient = MaxClientListItem & {
  chatId: string | null;
  source: string | null;
  firstSeenAt: Date;
  consentAt: Date | null;
  consentRevision: string | null;
  flowStep: string | null;
};

export type MaxMessageRecord = {
  id: string;
  direction: "in" | "out";
  author: "client" | "bot" | "operator";
  kind: string;
  text: string;
  attachments: (AttachmentMeta | { type: "inline_keyboard"; buttons: MaxButton[][] })[] | null;
  status: "received" | "pending" | "sending" | "sent" | "failed" | "unknown";
  error: string | null;
  eventTime: Date;
  createdAt: Date;
  sentAt: Date | null;
};

export type MaxNote = { id: string; body: string; createdAt: Date };

type ClientRow = {
  id: string;
  max_user_id: string;
  chat_id: string | null;
  first_name: string;
  last_name: string;
  username: string | null;
  source: string | null;
  phone: string;
  status: "open" | "closed";
  mode: "bot" | "operator";
  needs_reply: boolean;
  bot_blocked: boolean;
  flow_state: { step?: string } | null;
  consent_at: Date | null;
  consent_revision: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  last_message_at: Date | null;
  last_message_preview: string | null;
  last_message_direction: "in" | "out" | null;
  request_count: string;
};

const CLIENT_COLUMNS = `c.id, c.max_user_id, c.chat_id, c.first_name, c.last_name, c.username, c.source, c.phone, c.status, c.mode,
  c.needs_reply, c.bot_blocked, c.flow_state, c.consent_at, c.consent_revision, c.first_seen_at, c.last_seen_at,
  c.last_message_at, c.last_message_preview, c.last_message_direction,
  (SELECT count(*) FROM requests r WHERE r.max_client_id = c.id) AS request_count`;

function toClient(row: ClientRow): MaxClient {
  return {
    id: row.id,
    maxUserId: String(row.max_user_id),
    chatId: row.chat_id === null ? null : String(row.chat_id),
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    source: row.source,
    phone: row.phone,
    status: row.status,
    mode: row.mode,
    needsReply: row.needs_reply,
    botBlocked: row.bot_blocked,
    flowStep: row.flow_state?.step ?? null,
    consentAt: row.consent_at,
    consentRevision: row.consent_revision,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    lastMessageDirection: row.last_message_direction,
    requestCount: Number(row.request_count),
  };
}

export async function listMaxClients(filters: MaxFilters): Promise<{ items: MaxClientListItem[]; total: number; pageCount: number }> {
  const where = buildMaxWhere(filters);
  const offset = (filters.page - 1) * MAX_PAGE_SIZE;
  const [rows, count] = await Promise.all([
    query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS} FROM max_clients c ${where.sql}
       ORDER BY (c.needs_reply AND c.status = 'open') DESC, c.last_seen_at DESC, c.id DESC
       LIMIT ${MAX_PAGE_SIZE} OFFSET ${offset}`,
      where.params,
    ),
    query<{ count: string }>(`SELECT count(*) AS count FROM max_clients c ${where.sql}`, where.params),
  ]);
  const total = Number(count[0]?.count ?? 0);
  return { items: rows.map(toClient), total, pageCount: Math.max(1, Math.ceil(total / MAX_PAGE_SIZE)) };
}

export async function countMaxNeedsReply(): Promise<number> {
  const rows = await query<{ count: string }>("SELECT count(*) AS count FROM max_clients WHERE needs_reply AND status = 'open'");
  return Number(rows[0]?.count ?? 0);
}

export async function getMaxClient(id: string): Promise<MaxClient | null> {
  if (!isUuid(id)) return null;
  const rows = await query<ClientRow>(`SELECT ${CLIENT_COLUMNS} FROM max_clients c WHERE c.id = $1`, [id]);
  return rows[0] ? toClient(rows[0]) : null;
}

export const MESSAGES_PAGE = 50;

/** Сообщения диалога: последние MESSAGES_PAGE (или более ранние, чем before), в хронологическом порядке. */
export async function listMaxMessages(clientId: string, before?: string | null): Promise<{ items: MaxMessageRecord[]; hasMore: boolean }> {
  const params: unknown[] = [clientId];
  let condition = "";
  if (before && /^\d{1,18}$/.test(before)) {
    params.push(before);
    condition = "AND id < $2";
  }
  const rows = await query<{
    id: string;
    direction: "in" | "out";
    author: "client" | "bot" | "operator";
    kind: string;
    text: string;
    attachments: MaxMessageRecord["attachments"];
    status: MaxMessageRecord["status"];
    error: string | null;
    event_time: Date;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `SELECT id, direction, author, kind, text, attachments, status, error, event_time, created_at, sent_at
     FROM max_messages WHERE client_id = $1 ${condition} ORDER BY id DESC LIMIT ${MESSAGES_PAGE + 1}`,
    params,
  );
  const hasMore = rows.length > MESSAGES_PAGE;
  return {
    hasMore,
    items: rows
      .slice(0, MESSAGES_PAGE)
      .reverse()
      .map((row) => ({
        id: String(row.id),
        direction: row.direction,
        author: row.author,
        kind: row.kind,
        text: row.text,
        attachments: row.attachments,
        status: row.status,
        error: row.error,
        eventTime: row.event_time,
        createdAt: row.created_at,
        sentAt: row.sent_at,
      })),
  };
}

export async function listMaxNotes(clientId: string): Promise<MaxNote[]> {
  const rows = await query<{ id: string; body: string; created_at: Date }>(
    "SELECT id, body, created_at FROM max_notes WHERE client_id = $1 ORDER BY id DESC LIMIT 100",
    [clientId],
  );
  return rows.map((row) => ({ id: String(row.id), body: row.body, createdAt: row.created_at }));
}

export async function addMaxNote(clientId: string, body: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "INSERT INTO max_notes (client_id, body) SELECT id, $2 FROM max_clients WHERE id = $1 RETURNING id",
    [clientId, body],
  );
  return rows.length > 0;
}

export async function updateMaxClient(
  clientId: string,
  changes: { status?: "open" | "closed"; needsReply?: boolean; mode?: "bot" | "operator" },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [clientId];
  if (changes.status) {
    params.push(changes.status);
    sets.push(`status = $${params.length}`);
    if (changes.status === "closed") sets.push("needs_reply = false");
  }
  if (changes.needsReply !== undefined) {
    params.push(changes.needsReply);
    sets.push(`needs_reply = $${params.length}`);
  }
  if (changes.mode) {
    params.push(changes.mode);
    sets.push(`mode = $${params.length}`);
    // Возврат боту начинает сценарий с главного меню (незавершённая заявка сбрасывается).
    if (changes.mode === "bot") sets.push(`flow_state = '{"step":"menu"}'::jsonb`);
  }
  if (sets.length === 0) return false;
  const rows = await query<{ id: string }>(`UPDATE max_clients SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING id`, params);
  return rows.length > 0;
}

/** Удаление карточки клиента вместе с перепиской и заметками (заявки остаются, связь снимается). */
export async function deleteMaxClient(clientId: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM max_clients WHERE id = $1 RETURNING id", [clientId]);
  return rows.length > 0;
}

export type OperatorSendResult = SendOutcome & { messageId: string | null; duplicate?: boolean };

/**
 * Ответ оператора. Ключ idempotencyKey создаётся при открытии формы: повторная отправка той же
 * формы (двойное нажатие, повтор запроса) не отправляет сообщение второй раз.
 * Диалог переводится в режим оператора — бот перестаёт отвечать автоматически.
 */
export async function sendOperatorReply(clientId: string, text: string, idempotencyKey: string): Promise<OperatorSendResult> {
  const inserted = await query<{ id: string }>(
    `INSERT INTO max_messages (client_id, direction, author, kind, text, idempotency_key, status)
     SELECT id, 'out', 'operator', 'text', $2, $3, 'pending' FROM max_clients WHERE id = $1
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [clientId, text, isUuid(idempotencyKey) ? idempotencyKey : randomUUID()],
  );
  if (!inserted[0]) {
    const existing = await query<{ id: string; status: string; error: string | null }>(
      "SELECT id, status, error FROM max_messages WHERE idempotency_key = $1 AND client_id = $2",
      [idempotencyKey, clientId],
    );
    if (!existing[0]) return { status: "failed", error: "Диалог не найден.", messageId: null };
    const status = existing[0].status === "sent" || existing[0].status === "failed" || existing[0].status === "unknown" ? existing[0].status : "skipped";
    return { status, error: existing[0].error ?? undefined, messageId: String(existing[0].id), duplicate: true };
  }
  await query(
    "UPDATE max_clients SET mode = 'operator', needs_reply = false, status = 'open', updated_at = now() WHERE id = $1",
    [clientId],
  );
  const id = String(inserted[0].id);
  return { ...(await sendOutboxMessage(id)), messageId: id };
}

/**
 * Повтор отправки. Сообщение с ошибкой (failed) — сразу; с неизвестным результатом (unknown) —
 * только с явным подтверждением, потому что оно могло быть доставлено.
 */
export async function retryMaxMessage(clientId: string, messageId: string, allowUnknown: boolean): Promise<SendOutcome> {
  if (!/^\d{1,18}$/.test(messageId)) return { status: "skipped" };
  const rows = await query<{ id: string }>(
    `UPDATE max_messages SET status = 'pending', error = NULL
     WHERE id = $1 AND client_id = $2 AND direction = 'out' AND (status = 'failed' OR (status = 'unknown' AND $3))
     RETURNING id`,
    [messageId, clientId, allowUnknown],
  );
  if (!rows[0]) return { status: "skipped" };
  return sendOutboxMessage(messageId);
}
