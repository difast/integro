import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";
import { notify, throttledKey } from "@/lib/notifications/service";
import { isUuid } from "@/lib/requests/repository";

/**
 * Онлайн-чат на сайте: сторона посетителя.
 *
 * Сессия — случайный токен (32 байта) в cookie HttpOnly; в базе хранится только его SHA-256
 * (chat_clients.web_session_hash). Идентификатор диалога посетителю не выдаётся и для доступа не используется:
 * всё, что видит посетитель, выбирается по токену. Диалог создаётся только при первом сообщении.
 * Сообщения посетителя защищены от дублей ключом idempotency_key (общий уникальный индекс chat_messages).
 */

export const WEBCHAT_MESSAGE_MAX = 2000;
export const WEBCHAT_SESSION_DAYS = 30;
export const WEBCHAT_PAGE = 50;
/** Сколько секунд показывать «Анастасия печатает…» после последнего сигнала из админки. */
export const TYPING_SECONDS = 6;

export const newSessionToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export type WebSession = { clientId: string; status: "open" | "closed"; consented: boolean };

export async function findSession(token: string | undefined | null): Promise<WebSession | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const rows = await query<{ id: string; status: "open" | "closed"; consent_at: Date | null }>(
    `SELECT id, status, consent_at FROM chat_clients
     WHERE channel = 'web' AND web_session_hash = $1 AND web_session_expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  return row ? { clientId: row.id, status: row.status, consented: row.consent_at !== null } : null;
}

export type VisitorMessage = {
  id: string;
  from: "visitor" | "consultant";
  text: string;
  /** Для ответа консультанта — время, когда он стал виден посетителю. */
  createdAt: string;
};

type MessageRow = { id: string; direction: "in" | "out"; text: string; created_at: Date; sent_at: Date | null };
const toVisitorMessage = (r: MessageRow): VisitorMessage => ({
  id: String(r.id),
  from: r.direction === "in" ? "visitor" : "consultant",
  text: r.text,
  createdAt: (r.direction === "out" && r.sent_at ? r.sent_at : r.created_at).toISOString(),
});

// Посетителю видны его сообщения и ответы, которые сохранены и подтверждены (status = 'sent').
// Внутренние заметки хранятся в chat_notes и сюда не попадают.
const VISIBLE = "(m.direction = 'in' OR (m.direction = 'out' AND m.status = 'sent'))";

export type PostResult =
  | { ok: true; message: VisitorMessage; duplicate: boolean; token: string | null }
  | { ok: false; reason: "consent" | "conflict" };

/**
 * Сообщение посетителя. Без действующей сессии создаётся новый диалог и возвращается токен для cookie.
 * Повтор с тем же ключом (сетевой сбой, двойное нажатие) возвращает уже сохранённое сообщение.
 */
export async function postVisitorMessage(input: {
  token: string | null;
  text: string;
  key: string;
  consent: boolean;
  consentRevision: string;
  source: string | null;
}): Promise<PostResult> {
  const session = await findSession(input.token);
  if (!session && !input.consent) return { ok: false, reason: "consent" };
  if (!isUuid(input.key)) return { ok: false, reason: "conflict" };

  const result = await withTransaction(async (db) => {
    let clientId = session?.clientId ?? null;
    let token: string | null = null;
    if (!clientId) {
      token = newSessionToken();
      clientId = await createDialog(db, hashToken(token), input.consentRevision, input.source);
    }
    const { rows } = await db.query<MessageRow & { client_id: string }>(
      `INSERT INTO chat_messages (client_id, direction, author, kind, text, idempotency_key, status)
       VALUES ($1, 'in', 'client', 'text', $2, $3, 'received')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, direction, text, created_at, sent_at, client_id`,
      [clientId, input.text, input.key],
    );
    if (!rows[0]) {
      const existing = await db.query<MessageRow & { client_id: string }>(
        "SELECT id, direction, text, created_at, sent_at, client_id FROM chat_messages WHERE idempotency_key = $1",
        [input.key],
      );
      const found = existing.rows[0];
      // Ключ принадлежит другому диалогу — не раскрываем ни сам факт, ни содержимое.
      if (!found || found.client_id !== clientId || found.direction !== "in") return { conflict: true as const };
      return { message: toVisitorMessage(found), duplicate: true, token, clientId, needsNotify: false, messageId: String(found.id) };
    }
    const message = rows[0];
    const { rows: before } = await db.query<{ needs_reply: boolean }>(
      `UPDATE chat_clients c SET last_message_at = now(), last_message_preview = $2, last_message_direction = 'in',
         status = 'open', needs_reply = true, last_seen_at = now(), visitor_active_at = now(),
         web_session_expires_at = now() + make_interval(days => $3), updated_at = now()
       FROM (SELECT needs_reply FROM chat_clients WHERE id = $1) old
       WHERE c.id = $1 RETURNING old.needs_reply`,
      [clientId, preview(input.text), WEBCHAT_SESSION_DAYS],
    );
    const link = `/admin/obrashcheniya/${clientId}`;
    const short = preview(input.text).slice(0, 120);
    await notify(
      { type: "message", channel: "web", title: "Новое сообщение · Веб-чат", body: `Посетитель сайта: ${short}`, link, dedupeKey: await throttledKey(`message:${clientId}`) },
      db,
    );
    if (!before[0]?.needs_reply) {
      await notify({ type: "needs_reply", channel: "web", title: "Нужен ответ · Веб-чат", body: "Посетитель сайта ждёт ответа", link, dedupeKey: `needs_reply:web:${message.id}` }, db);
    }
    return { message: toVisitorMessage(message), duplicate: false, token, clientId, needsNotify: true, messageId: String(message.id) };
  });

  if ("conflict" in result) return { ok: false, reason: "conflict" };
  if (result.needsNotify) await deliverPendingNotifications();
  return { ok: true, message: result.message, duplicate: result.duplicate, token: result.token };
}

async function createDialog(db: PoolClient, tokenHash: string, consentRevision: string, source: string | null): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO chat_clients (channel, external_user_id, first_name, last_name, source, mode, status, consent_at, consent_revision,
       web_session_hash, web_session_expires_at, first_seen_at, last_seen_at)
     VALUES ('web', nextval('web_chat_visitor_seq'), '', '', $1, 'operator', 'open', now(), $2, $3, now() + make_interval(days => $4), now(), now())
     RETURNING id`,
    [source, consentRevision.slice(0, 40), tokenHash, WEBCHAT_SESSION_DAYS],
  );
  return rows[0]!.id;
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

export type VisitorUpdates = {
  messages: VisitorMessage[];
  hasMore: boolean;
  /** Время сервера для следующего запроса (since): ответы, ставшие видимыми позже, придут даже с меньшим id. */
  serverTime: string;
  typing: boolean;
  status: "open" | "closed";
  /** Число ответов консультанта, которые посетитель ещё не видел (после visitor_read_at). */
  unread: number;
};

/**
 * Обновления для виджета. Без after/since — последние WEBCHAT_PAGE сообщений; с before — более ранние.
 * С after и since — сообщения с id > after и ответы, ставшие видимыми после since (без дублей: виджет
 * объединяет по id).
 */
export async function getVisitorUpdates(session: WebSession, cursor: { after: string | null; since: string | null; before: string | null }): Promise<VisitorUpdates> {
  const params: unknown[] = [session.clientId];
  let where = `m.client_id = $1 AND ${VISIBLE}`;
  let order = "m.id DESC";
  let limit = WEBCHAT_PAGE + 1;
  if (cursor.before) {
    params.push(cursor.before);
    where += ` AND m.id < $${params.length}`;
  } else if (cursor.after) {
    params.push(cursor.after);
    const afterParam = `$${params.length}`;
    if (cursor.since) {
      params.push(cursor.since);
      where += ` AND (m.id > ${afterParam} OR (m.direction = 'out' AND m.sent_at > $${params.length}))`;
    } else {
      where += ` AND m.id > ${afterParam}`;
    }
    order = "m.id ASC";
    limit = 200;
  }
  const [rows, meta] = await Promise.all([
    query<MessageRow>(`SELECT m.id, m.direction, m.text, m.created_at, m.sent_at FROM chat_messages m WHERE ${where} ORDER BY ${order} LIMIT ${limit}`, params),
    query<{ now: Date; typing: boolean; status: "open" | "closed"; unread: string }>(
      `UPDATE chat_clients c SET visitor_active_at = now()
       WHERE c.id = $1
       RETURNING now() AS now, coalesce(c.operator_typing_until > now(), false) AS typing, c.status,
         (SELECT count(*) FROM chat_messages m WHERE m.client_id = c.id AND m.direction = 'out' AND m.status = 'sent'
            AND m.sent_at > coalesce(c.visitor_read_at, '-infinity'::timestamptz)) AS unread`,
      [session.clientId],
    ),
  ]);
  const paged = !cursor.after;
  const hasMore = paged && rows.length > WEBCHAT_PAGE;
  const list = (hasMore ? rows.slice(0, WEBCHAT_PAGE) : rows).map(toVisitorMessage);
  const m = meta[0]!;
  return {
    messages: paged ? list.reverse() : list,
    hasMore,
    // Небольшой запас на расхождение часов между запросами — дубли виджет отбрасывает по id.
    serverTime: new Date(m.now.getTime() - 2000).toISOString(),
    typing: m.typing,
    status: m.status,
    unread: Number(m.unread),
  };
}

/** Посетитель открыл чат и видит ответы — для отметки «прочитано» в админке. */
export async function markVisitorRead(session: WebSession): Promise<void> {
  await query("UPDATE chat_clients SET visitor_read_at = now(), visitor_active_at = now() WHERE id = $1", [session.clientId]);
}

// --- Сторона оператора ---

/** Сигнал «оператор набирает ответ» — только для веб-чата, живёт TYPING_SECONDS. */
export async function setOperatorTyping(clientId: string, typing: boolean): Promise<boolean> {
  if (!isUuid(clientId)) return false;
  const rows = await query<{ id: string }>(
    `UPDATE chat_clients SET operator_typing_until = CASE WHEN $2 THEN now() + make_interval(secs => $3) ELSE NULL END
     WHERE id = $1 AND channel = 'web' RETURNING id`,
    [clientId, typing, TYPING_SECONDS],
  );
  return rows.length > 0;
}
