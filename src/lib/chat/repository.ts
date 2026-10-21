import "server-only";
import { randomUUID } from "node:crypto";
import { botFollowUps } from "@/config/chat-bot";
import { query, withTransaction } from "@/lib/db";
import { isUuid } from "@/lib/requests/repository";
import { buildChatWhere, CHAT_PAGE_SIZE, type ChatFilters } from "./filters";
import { sendOutboxMessage, type SendOutcome } from "./processor";
import type { AttachmentMeta, BotButton, Channel } from "./types";

/** Запросы панели администратора к обращениям из мессенджеров (все каналы). */

export type ChatClientListItem = {
  id: string;
  channel: Channel;
  externalUserId: string;
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
  /** Сообщения клиента после последнего просмотра диалога оператором. */
  unreadCount: number;
  /** Последняя активность посетителя веб-чата (открытый виджет опрашивает сервер). */
  visitorActiveAt: Date | null;
};

export type ChatClient = ChatClientListItem & {
  chatId: string | null;
  source: string | null;
  firstSeenAt: Date;
  consentAt: Date | null;
  consentRevision: string | null;
  flowStep: string | null;
  personId: string | null;
  reminderStage: number;
  lastReminderAt: Date | null;
  surveyDueAt: Date | null;
  surveySentAt: Date | null;
  qualifiedAt: Date | null;
  /** Когда посетитель веб-чата последний раз видел ответы — для отметки «прочитано». */
  visitorReadAt: Date | null;
};

export type ChatMessageRecord = {
  id: string;
  direction: "in" | "out";
  author: "client" | "bot" | "operator";
  kind: string;
  text: string;
  attachments: (AttachmentMeta | { type: "inline_keyboard"; buttons: BotButton[][] } | { type: "remove_keyboard" })[] | null;
  status: "received" | "pending" | "sending" | "sent" | "failed" | "unknown";
  error: string | null;
  externalMessageId: string | null;
  eventTime: Date;
  createdAt: Date;
  sentAt: Date | null;
};

export type ChatNote = { id: string; body: string; createdAt: Date };

type ClientRow = {
  id: string;
  channel: Channel;
  external_user_id: string;
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
  person_id: string | null;
  reminder_stage: number;
  last_reminder_at: Date | null;
  survey_due_at: Date | null;
  survey_sent_at: Date | null;
  qualified_at: Date | null;
  visitor_read_at: Date | null;
  visitor_active_at: Date | null;
  request_count: string;
  unread_count: string;
};

const CLIENT_COLUMNS = `c.id, c.channel, c.external_user_id, c.chat_id, c.first_name, c.last_name, c.username, c.source, c.phone,
  c.status, c.mode, c.needs_reply, c.bot_blocked, c.flow_state, c.consent_at, c.consent_revision, c.first_seen_at,
  c.last_seen_at, c.last_message_at, c.last_message_preview, c.last_message_direction, c.person_id,
  c.reminder_stage, c.last_reminder_at, c.survey_due_at, c.survey_sent_at, c.qualified_at,
  c.visitor_read_at, c.visitor_active_at,
  (SELECT count(*) FROM requests r WHERE r.chat_client_id = c.id) AS request_count,
  (SELECT count(*) FROM chat_messages m WHERE m.client_id = c.id AND m.direction = 'in'
     AND m.created_at > coalesce(c.operator_read_at, '-infinity'::timestamptz)) AS unread_count`;

function toClient(row: ClientRow): ChatClient {
  return {
    id: row.id,
    channel: row.channel,
    externalUserId: String(row.external_user_id),
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
    personId: row.person_id,
    reminderStage: row.reminder_stage,
    lastReminderAt: row.last_reminder_at,
    surveyDueAt: row.survey_due_at,
    surveySentAt: row.survey_sent_at,
    qualifiedAt: row.qualified_at,
    visitorReadAt: row.visitor_read_at,
    visitorActiveAt: row.visitor_active_at,
    unreadCount: Number(row.unread_count),
    requestCount: Number(row.request_count),
  };
}

export async function listChatClients(filters: ChatFilters): Promise<{ items: ChatClientListItem[]; total: number; pageCount: number }> {
  const where = buildChatWhere(filters);
  const offset = (filters.page - 1) * CHAT_PAGE_SIZE;
  const [rows, count] = await Promise.all([
    query<ClientRow>(
      `SELECT ${CLIENT_COLUMNS} FROM chat_clients c ${where.sql}
       ORDER BY (c.needs_reply AND c.status = 'open') DESC, c.last_seen_at DESC, c.id DESC
       LIMIT ${CHAT_PAGE_SIZE} OFFSET ${offset}`,
      where.params,
    ),
    query<{ count: string }>(`SELECT count(*) AS count FROM chat_clients c ${where.sql}`, where.params),
  ]);
  const total = Number(count[0]?.count ?? 0);
  return { items: rows.map(toClient), total, pageCount: Math.max(1, Math.ceil(total / CHAT_PAGE_SIZE)) };
}

export async function countChatNeedsReply(): Promise<Record<Channel | "total", number>> {
  const rows = await query<{ channel: Channel; count: string }>(
    "SELECT channel, count(*) AS count FROM chat_clients WHERE needs_reply AND status = 'open' GROUP BY channel",
  );
  const result: Record<Channel | "total", number> = { max: 0, telegram: 0, web: 0, total: 0 };
  for (const row of rows) {
    result[row.channel] = Number(row.count);
    result.total += Number(row.count);
  }
  return result;
}

export async function getChatClient(id: string): Promise<ChatClient | null> {
  if (!isUuid(id)) return null;
  const rows = await query<ClientRow>(`SELECT ${CLIENT_COLUMNS} FROM chat_clients c WHERE c.id = $1`, [id]);
  return rows[0] ? toClient(rows[0]) : null;
}

export const MESSAGES_PAGE = 50;

/** Сообщения диалога: последние MESSAGES_PAGE (или более ранние, чем before), в хронологическом порядке. */
export async function listChatMessages(clientId: string, before?: string | null): Promise<{ items: ChatMessageRecord[]; hasMore: boolean }> {
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
    attachments: ChatMessageRecord["attachments"];
    status: ChatMessageRecord["status"];
    error: string | null;
    external_message_id: string | null;
    event_time: Date;
    created_at: Date;
    sent_at: Date | null;
  }>(
    `SELECT id, direction, author, kind, text, attachments, status, error, external_message_id, event_time, created_at, sent_at
     FROM chat_messages WHERE client_id = $1 ${condition} ORDER BY id DESC LIMIT ${MESSAGES_PAGE + 1}`,
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
        externalMessageId: row.external_message_id,
        eventTime: row.event_time,
        createdAt: row.created_at,
        sentAt: row.sent_at,
      })),
  };
}

export async function listChatNotes(clientId: string): Promise<ChatNote[]> {
  const rows = await query<{ id: string; body: string; created_at: Date }>(
    "SELECT id, body, created_at FROM chat_notes WHERE client_id = $1 ORDER BY id DESC LIMIT 100",
    [clientId],
  );
  return rows.map((row) => ({ id: String(row.id), body: row.body, createdAt: row.created_at }));
}

export async function addChatNote(clientId: string, body: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "INSERT INTO chat_notes (client_id, body) SELECT id, $2 FROM chat_clients WHERE id = $1 RETURNING id",
    [clientId, body],
  );
  return rows.length > 0;
}

export async function updateChatClient(
  clientId: string,
  changes: { status?: "open" | "closed"; needsReply?: boolean; mode?: "bot" | "operator"; qualified?: boolean },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [clientId];
  if (changes.status) {
    params.push(changes.status);
    sets.push(`status = $${params.length}`);
    if (changes.status === "closed") {
      sets.push("needs_reply = false");
      // Опрос после закрытия — если клиент писал в диалог и опрос ещё не отправлялся после его последнего сообщения.
      if (botFollowUps.enabled) {
        params.push(botFollowUps.surveyDelayMinutes);
        // В веб-чате кнопок опроса нет — опрос только в мессенджерах с ботом.
        sets.push(`survey_due_at = CASE WHEN status = 'open' AND channel <> 'web' AND NOT bot_blocked AND last_message_at IS NOT NULL
          AND (survey_sent_at IS NULL OR survey_sent_at < last_message_at)
          THEN now() + make_interval(mins => $${params.length}) ELSE survey_due_at END`);
      }
    } else {
      sets.push("survey_due_at = NULL");
    }
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
  if (changes.qualified !== undefined) {
    // Первая отметка сохраняется: повторное включение не сдвигает дату квалификации.
    sets.push(changes.qualified ? "qualified_at = coalesce(qualified_at, now())" : "qualified_at = NULL");
  }
  if (sets.length === 0) return false;
  const rows = await query<{ id: string }>(`UPDATE chat_clients SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING id`, params);
  return rows.length > 0;
}

/** Удаление карточки клиента вместе с перепиской и заметками (заявки остаются, связь снимается). */
export async function deleteChatClient(clientId: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM chat_clients WHERE id = $1 RETURNING id", [clientId]);
  return rows.length > 0;
}

// --- Связь карточек одного человека из разных каналов (только вручную) ---

/** Карточки, связанные с данной (тот же человек в других каналах или аккаунтах). */
export async function listLinkedClients(clientId: string): Promise<ChatClientListItem[]> {
  const rows = await query<ClientRow>(
    `SELECT ${CLIENT_COLUMNS} FROM chat_clients c
     WHERE c.person_id IS NOT NULL AND c.id <> $1 AND c.person_id = (SELECT person_id FROM chat_clients WHERE id = $1)
     ORDER BY c.last_seen_at DESC LIMIT 20`,
    [clientId],
  );
  return rows.map(toClient);
}

/** Кандидаты для связи: поиск по имени, username, ID или телефону среди других карточек. */
export async function searchLinkCandidates(clientId: string, q: string): Promise<ChatClientListItem[]> {
  if (!q.trim()) return [];
  const where = buildChatWhere({ q: q.trim().slice(0, 100), filter: "", period: "", channel: "", page: 1 });
  const params = [...where.params, clientId];
  const rows = await query<ClientRow>(
    `SELECT ${CLIENT_COLUMNS} FROM chat_clients c ${where.sql} ${where.sql ? "AND" : "WHERE"} c.id <> $${params.length}
     ORDER BY c.last_seen_at DESC LIMIT 5`,
    params,
  );
  return rows.map(toClient);
}

/** Связывает две карточки (группы карточек) в одну: общий person_id. Данные карточек не объединяются. */
export async function linkChatClients(clientId: string, otherId: string): Promise<boolean> {
  if (!isUuid(clientId) || !isUuid(otherId) || clientId === otherId) return false;
  return withTransaction(async (db) => {
    const { rows } = await db.query<{ id: string; person_id: string | null }>(
      "SELECT id, person_id FROM chat_clients WHERE id = ANY($1::uuid[]) FOR UPDATE",
      [[clientId, otherId]],
    );
    if (rows.length !== 2) return false;
    const a = rows.find((r) => r.id === clientId)!;
    const b = rows.find((r) => r.id === otherId)!;
    const person = a.person_id ?? b.person_id ?? randomUUID();
    const groups = [a.person_id, b.person_id].filter((p): p is string => Boolean(p) && p !== person);
    await db.query("UPDATE chat_clients SET person_id = $1, updated_at = now() WHERE id = ANY($2::uuid[]) OR person_id = ANY($3::uuid[])", [
      person,
      [clientId, otherId],
      groups,
    ]);
    return true;
  });
}

/** Отвязывает карточку от группы; оставшаяся в одиночестве карточка тоже отвязывается. */
export async function unlinkChatClient(clientId: string): Promise<boolean> {
  if (!isUuid(clientId)) return false;
  return withTransaction(async (db) => {
    const { rows } = await db.query<{ person_id: string | null }>("SELECT person_id FROM chat_clients WHERE id = $1 FOR UPDATE", [clientId]);
    const person = rows[0]?.person_id;
    if (!person) return false;
    await db.query("UPDATE chat_clients SET person_id = NULL, updated_at = now() WHERE id = $1", [clientId]);
    await db.query(
      `UPDATE chat_clients SET person_id = NULL, updated_at = now()
       WHERE person_id = $1 AND (SELECT count(*) FROM chat_clients WHERE person_id = $1) = 1`,
      [person],
    );
    return true;
  });
}

/** Оператор открыл диалог: сообщения клиента до этого момента прочитаны. */
export async function markOperatorRead(clientId: string): Promise<void> {
  if (!isUuid(clientId)) return;
  await query("UPDATE chat_clients SET operator_read_at = now() WHERE id = $1", [clientId]);
}

// --- Ответ оператора ---

export type OperatorSendResult = SendOutcome & { messageId: string | null; duplicate?: boolean };

/**
 * Ответ оператора. Ключ idempotencyKey создаётся при открытии формы: повторная отправка той же
 * формы (двойное нажатие, повтор запроса) не отправляет сообщение второй раз.
 * Диалог переводится в режим оператора — бот перестаёт отвечать автоматически.
 */
export async function sendOperatorReply(clientId: string, text: string, idempotencyKey: string): Promise<OperatorSendResult> {
  const inserted = await query<{ id: string }>(
    `INSERT INTO chat_messages (client_id, direction, author, kind, text, idempotency_key, status)
     SELECT id, 'out', 'operator', 'text', $2, $3, 'pending' FROM chat_clients WHERE id = $1
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [clientId, text, isUuid(idempotencyKey) ? idempotencyKey : randomUUID()],
  );
  if (!inserted[0]) {
    const existing = await query<{ id: string; status: string; error: string | null }>(
      "SELECT id, status, error FROM chat_messages WHERE idempotency_key = $1 AND client_id = $2",
      [idempotencyKey, clientId],
    );
    if (!existing[0]) return { status: "failed", error: "Диалог не найден.", messageId: null };
    const status = existing[0].status === "sent" || existing[0].status === "failed" || existing[0].status === "unknown" ? existing[0].status : "skipped";
    return { status, error: existing[0].error ?? undefined, messageId: String(existing[0].id), duplicate: true };
  }
  // Ответ отправлен — «печатает» у посетителя веб-чата снимается, входящие считаются прочитанными.
  await query(
    `UPDATE chat_clients SET mode = 'operator', needs_reply = false, status = 'open', operator_typing_until = NULL,
       operator_read_at = now(), updated_at = now() WHERE id = $1`,
    [clientId],
  );
  const id = String(inserted[0].id);
  return { ...(await sendOutboxMessage(id)), messageId: id };
}

/**
 * Повтор отправки. Сообщение с ошибкой (failed) — сразу; с неизвестным результатом (unknown) —
 * только с явным подтверждением, потому что оно могло быть доставлено.
 */
export async function retryChatMessage(clientId: string, messageId: string, allowUnknown: boolean): Promise<SendOutcome> {
  if (!/^\d{1,18}$/.test(messageId)) return { status: "skipped" };
  const rows = await query<{ id: string }>(
    `UPDATE chat_messages SET status = 'pending', error = NULL
     WHERE id = $1 AND client_id = $2 AND direction = 'out' AND (status = 'failed' OR (status = 'unknown' AND $3))
     RETURNING id`,
    [messageId, clientId, allowUnknown],
  );
  if (!rows[0]) return { status: "skipped" };
  return sendOutboxMessage(messageId);
}
