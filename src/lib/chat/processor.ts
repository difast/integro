import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { company } from "@/config/company";
import { botButtons, botDirections, botTexts } from "@/config/chat-bot";
import { getService } from "@/config/services";
import { describeDbError, query, withTransaction } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { searchDigits } from "@/lib/requests/filters";
import { createRequest } from "@/lib/requests/repository";
import { absoluteUrl } from "@/lib/site";
import type { ChannelAdapter } from "./adapter";
import { ChannelApiError } from "./errors";
import { getAdapter } from "./registry";
import { directionLabel, readState, runScenario, type BotInput, type BotReply } from "./scenario";
import { channelLabels, isChannel, type AttachmentMeta, type BotButton, type Channel, type IncomingEvent } from "./types";

/**
 * Обработка событий мессенджеров и отправка сообщений — общая для всех каналов.
 *
 * 1. Webhook канала сохраняет событие в chat_events (уникальный ключ — защита от повторной
 *    доставки) и сразу отвечает платформе.
 * 2. processEvent в одной транзакции: обновляет карточку клиента, сохраняет входящее сообщение,
 *    выполняет сценарий, создаёт заявку и ставит ответы в очередь (chat_messages, status=pending).
 *    Повторная обработка того же события невозможна: событие захватывается атомарно.
 * 3. После фиксации транзакции ответы отправляются по одному (sendOutboxMessage) через адаптер
 *    канала. Каждое сообщение автоматически отправляется не более одного раза: при неизвестном
 *    результате (тайм-аут) оно получает статус unknown и повторяется только вручную из админки.
 */

const MAX_ATTEMPTS = 5;
/** Защита от циклов и лавины ответов: не больше стольких автоответов клиенту в минуту. */
const BOT_REPLIES_PER_MINUTE = 30;

type Known = Exclude<IncomingEvent, { kind: "ignored" }>;

type ClientRow = {
  id: string;
  mode: "bot" | "operator";
  status: "open" | "closed";
  flow_state: unknown;
  consent_revision: string | null;
  bot_blocked: boolean;
};

function errorText(error: unknown): string {
  if (error instanceof ChannelApiError) return error.summary;
  return describeDbError(error).slice(0, 300) || "unknown error";
}

/** Подпись нажатой кнопки для истории переписки (по известным payload). */
export function callbackLabel(payload: string): string {
  const direct: Record<string, string> = {
    menu: botButtons.menu,
    "sec:ocenka": botButtons.ocenka,
    "sec:ocenka:goals": botButtons.ocenkaGoals,
    "sec:sudeb": botButtons.sudeb,
    "sec:issled": botButtons.issled,
    apply: botButtons.apply,
    specialist: botButtons.specialist,
    cancel: botButtons.cancel,
    back: botButtons.back,
    "consent:yes": botButtons.consentYes,
    skip: botButtons.skip,
    confirm: botButtons.confirm,
    edit: botButtons.edit,
    summary: botButtons.backToSummary,
    "edit:name": botButtons.editName,
    "edit:direction": botButtons.editDirection,
    "edit:description": botButtons.editDescription,
    "edit:phone": botButtons.editPhone,
    "edit:contact_time": botButtons.editContactTime,
  };
  if (direct[payload]) return direct[payload];
  const direction = botDirections.find((d) => `dir:${d.payload}` === payload);
  return direction?.label ?? payload.slice(0, 100);
}

function preview(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 280 ? `${line.slice(0, 277)}…` : line;
}

// --- Приём события ---

/** Сохраняет событие канала. duplicate — такое событие уже было получено (повторная доставка). */
export async function storeEvent(channel: Channel, raw: unknown): Promise<{ id: string; duplicate: boolean } | null> {
  const adapter = getAdapter(channel);
  const event = adapter.parse(raw);
  if (!event) return null;
  const userId = event.kind === "ignored" ? event.userId : event.user.id;
  const rows = await query<{ id: string }>(
    `INSERT INTO chat_events (channel, event_key, update_type, external_user_id, event_time, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [
      channel,
      event.key,
      adapter.updateType(raw),
      userId,
      event.time,
      event.kind === "ignored" ? null : JSON.stringify(raw),
      event.kind === "ignored" ? "ignored" : "pending",
    ],
  );
  if (rows[0]) return { id: String(rows[0].id), duplicate: false };
  return { id: "", duplicate: true };
}

// --- Обработка события ---

type AfterCommit = {
  adapter: ChannelAdapter;
  outbox: string[];
  callback: { event: Extract<Known, { kind: "callback" }>; notification?: string; clearKeyboard: boolean } | null;
  notify: { requestId: string; number: string; summary: string[] } | null;
};

async function upsertClient(db: PoolClient, channel: Channel, event: Known): Promise<ClientRow> {
  const user = event.user;
  const source = event.kind === "start" ? event.payload : null;
  await db.query(
    `INSERT INTO chat_clients (channel, external_user_id, chat_id, first_name, last_name, username, source, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (channel, external_user_id) DO UPDATE SET
       chat_id = coalesce(EXCLUDED.chat_id, chat_clients.chat_id),
       first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE chat_clients.first_name END,
       last_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.last_name ELSE chat_clients.last_name END,
       username = EXCLUDED.username,
       source = coalesce(chat_clients.source, EXCLUDED.source),
       last_seen_at = greatest(chat_clients.last_seen_at, EXCLUDED.last_seen_at),
       updated_at = now()`,
    [channel, user.id, event.chatId, user.firstName, user.lastName, user.username, source, event.time],
  );
  const { rows } = await db.query<ClientRow>(
    `SELECT id, mode, status, flow_state, consent_revision, bot_blocked
     FROM chat_clients WHERE channel = $1 AND external_user_id = $2 FOR UPDATE`,
    [channel, user.id],
  );
  return rows[0]!;
}

async function insertIncoming(db: PoolClient, clientId: string, eventId: string, event: Known): Promise<boolean> {
  let kind: string = event.kind;
  let text = "";
  let attachments: AttachmentMeta[] | null = null;
  let messageKey: string | null = null;
  let messageId: string | null = null;
  if (event.kind === "start") text = event.payload ? `Запуск бота (метка: ${event.payload})` : "Запуск бота";
  if (event.kind === "stop") text = event.reason === "stopped" ? "Клиент остановил бота" : "Клиент удалил диалог с ботом";
  if (event.kind === "resume") text = "Клиент снова разрешил боту писать";
  if (event.kind === "callback") {
    text = `Нажата кнопка «${callbackLabel(event.payload)}»`;
    messageId = event.sourceMessageId;
  }
  if (event.kind === "message") {
    messageKey = event.messageKey;
    messageId = event.messageId;
    text = event.text;
    attachments = event.attachments.length ? event.attachments : null;
    kind = event.contactPhone ? "contact" : event.attachments.length && !event.text ? "attachment" : "text";
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO chat_messages (client_id, direction, author, kind, text, attachments, external_mid, external_message_id,
       external_chat_id, external_user_id, event_id, status, event_time)
     VALUES ($1, 'in', 'client', $2, $3, $4, $5, $6, $7, $8, $9, 'received', $10)
     ON CONFLICT (external_mid) DO NOTHING
     RETURNING id`,
    [
      clientId,
      kind,
      text.slice(0, 4000),
      attachments ? JSON.stringify(attachments) : null,
      messageKey,
      messageId,
      event.chatId,
      event.user.id,
      eventId,
      event.time,
    ],
  );
  if (!rows[0]) return false;
  if (event.kind !== "stop" && event.kind !== "resume") {
    await db.query(
      `UPDATE chat_clients SET last_message_at = $2, last_message_preview = $3, last_message_direction = 'in',
         status = 'open', updated_at = now() WHERE id = $1`,
      [clientId, event.time, preview(text) || "(вложение)"],
    );
  }
  return true;
}

async function queueReply(db: PoolClient, clientId: string, reply: BotReply): Promise<string> {
  const attachments: unknown[] = [];
  if (reply.buttons?.length) attachments.push({ type: "inline_keyboard", buttons: reply.buttons });
  if (reply.removeKeyboard) attachments.push({ type: "remove_keyboard" });
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO chat_messages (client_id, direction, author, kind, text, attachments, idempotency_key, status)
     VALUES ($1, 'out', 'bot', 'text', $2, $3, $4, 'pending') RETURNING id`,
    [clientId, reply.text.slice(0, 4000), attachments.length ? JSON.stringify(attachments) : null, randomUUID()],
  );
  return String(rows[0]!.id);
}

function toBotInput(event: Exclude<Known, { kind: "stop" | "resume" }>): BotInput {
  if (event.kind === "start") return { type: "start" };
  if (event.kind === "callback") return { type: "callback", payload: event.payload };
  if (event.contactPhone !== null || event.attachments.some((a) => a.type === "contact")) return { type: "contact", phone: event.contactPhone };
  if (!event.text && event.attachments.length) return { type: "attachment" };
  return { type: "text", text: event.text };
}

/** Короткий номер заявки для клиента: первые 8 символов идентификатора. */
export function requestNumber(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function handleEvent(db: PoolClient, adapter: ChannelAdapter, eventId: string, event: Known): Promise<AfterCommit> {
  const after: AfterCommit = { adapter, outbox: [], callback: null, notify: null };
  const client = await upsertClient(db, adapter.channel, event);
  const fresh = await insertIncoming(db, client.id, eventId, event);
  if (!fresh) return after;

  if (event.kind === "stop") {
    await db.query("UPDATE chat_clients SET bot_blocked = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }
  if (event.kind === "resume" || (event.kind !== "callback" && client.bot_blocked)) {
    // Клиент снова пишет или разрешил боту писать — доставка снова возможна.
    await db.query("UPDATE chat_clients SET bot_blocked = false, updated_at = now() WHERE id = $1", [client.id]);
    if (event.kind === "resume") return after;
  }

  if (event.kind === "callback") {
    after.callback =
      client.mode === "operator"
        ? { event, notification: botTexts.operatorMode, clearKeyboard: false }
        : { event, notification: callbackLabel(event.payload), clearKeyboard: true };
  }

  // Режим оператора: бот молчит, диалог помечается как требующий ответа.
  if (client.mode === "operator") {
    await db.query("UPDATE chat_clients SET needs_reply = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }

  const { rows: recent } = await db.query<{ count: string }>(
    `SELECT count(*) AS count FROM chat_messages
     WHERE client_id = $1 AND direction = 'out' AND author = 'bot' AND created_at > now() - interval '1 minute'`,
    [client.id],
  );
  if (Number(recent[0]?.count ?? 0) >= BOT_REPLIES_PER_MINUTE) {
    console.warn(`[${adapter.channel}] auto-reply limit reached for a client, waiting for an operator`);
    await db.query("UPDATE chat_clients SET needs_reply = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }

  const previous = readState(client.flow_state);
  const result = runScenario(previous, toBotInput(event), {
    hasConsent: client.consent_revision === company.legalRevisionDate,
    newKey: randomUUID,
  });

  let replies = [...result.replies];
  if (result.submit) {
    const draft = result.submit;
    const direction = botDirections.find((d) => d.payload === draft.direction) ?? botDirections[3];
    const service = direction.serviceSlug ? getService(direction.serviceSlug) : undefined;
    const message = [draft.description, draft.contactTime ? `\nУдобное время для связи: ${draft.contactTime}` : ""].join("").trim();
    const saved = await createRequest(
      {
        submissionKey: draft.key,
        name: draft.name,
        phone: draft.phone ?? "",
        email: "",
        service: service?.slug ?? "",
        serviceTitle: service?.title ?? "Не выбрано",
        message: message.slice(0, 3000),
        sourcePage: null,
        context: adapter.channel === "telegram" ? "Telegram-бот" : "Чат-бот MAX",
        consentRevision: client.consent_revision ?? company.legalRevisionDate,
        channel: adapter.channel,
        chatClientId: client.id,
      },
      db,
    );
    const number = requestNumber(saved.id);
    replies.push({ text: botTexts.submitted(number), buttons: [[{ type: "callback", text: botButtons.menu, payload: "menu" }]] });
    if (saved.created) {
      after.notify = {
        requestId: saved.id,
        number,
        summary: [
          `Имя: ${draft.name}`,
          `Телефон: ${draft.phone || "—"}`,
          `Направление: ${directionLabel(draft.direction)}`,
          ...(draft.contactTime ? [`Удобное время связи: ${draft.contactTime}`] : []),
          "",
          "Описание:",
          draft.description,
        ],
      };
    }
  }
  if (adapter.adaptReplies) replies = adapter.adaptReplies(previous.step, result.state.step, replies);

  await db.query(
    `UPDATE chat_clients SET
       flow_state = $2,
       needs_reply = needs_reply OR $3,
       consent_at = CASE WHEN $4 THEN now() ELSE consent_at END,
       consent_revision = CASE WHEN $4 THEN $5 ELSE consent_revision END,
       phone = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE phone END,
       phone_digits = CASE WHEN $6::text IS NOT NULL THEN $7 ELSE phone_digits END,
       updated_at = now()
     WHERE id = $1`,
    [
      client.id,
      JSON.stringify(result.state),
      Boolean(result.needsReply),
      Boolean(result.consentGiven),
      company.legalRevisionDate,
      result.phone ?? null,
      result.phone ? searchDigits(result.phone) : "",
    ],
  );

  for (const reply of replies) after.outbox.push(await queueReply(db, client.id, reply));
  return after;
}

async function runAfterCommit(after: AfterCommit): Promise<void> {
  if (after.callback) {
    try {
      await after.adapter.acknowledgeCallback(after.callback.event, {
        notification: after.callback.notification,
        clearKeyboard: after.callback.clearKeyboard,
      });
    } catch (error) {
      console.warn(`[${after.adapter.channel}] callback answer failed:`, errorText(error));
    }
  }
  for (const id of after.outbox) await sendOutboxMessage(id);

  if (after.notify && isMailConfigured()) {
    const link = absoluteUrl(`/admin/zayavki/${after.notify.requestId}`);
    const title = after.adapter.channel === "telegram" ? "Telegram-бота" : "чат-бота MAX";
    try {
      await sendMail({
        subject: `Заявка из ${title} № ${after.notify.number}`,
        text: [
          `Новая заявка из ${title} ${company.legalName}`,
          "",
          ...after.notify.summary,
          "",
          `Клиент дал согласие на обработку персональных данных в чат-боте (редакция от ${company.legalRevisionDate}).`,
          ...(link ? ["", `Заявка в панели администратора: ${link}`] : []),
        ].join("\n"),
      });
    } catch (error) {
      console.error(`[${after.adapter.channel}] request saved, notification email failed:`, error instanceof Error ? error.message : "unknown error");
    }
  }
}

/**
 * Обрабатывает сохранённое событие. Безопасно вызывать повторно и параллельно:
 * событие захватывается атомарно, обработанное повторно не выполняется.
 */
export async function processEvent(eventId: string): Promise<void> {
  const claimed = await query<{ payload: unknown; channel: string }>(
    `UPDATE chat_events SET status = 'processing', attempts = attempts + 1, claimed_at = now()
     WHERE id = $1 AND status IN ('pending', 'failed') AND attempts < ${MAX_ATTEMPTS}
     RETURNING payload, channel`,
    [eventId],
  );
  const row = claimed[0];
  if (!row) return;
  if (!isChannel(row.channel)) return;
  const adapter = getAdapter(row.channel);

  const event = adapter.parse(row.payload);
  if (!event || event.kind === "ignored") {
    await query("UPDATE chat_events SET status = 'ignored', payload = NULL, processed_at = now() WHERE id = $1", [eventId]);
    return;
  }

  let after: AfterCommit;
  try {
    after = await withTransaction(async (db) => {
      const result = await handleEvent(db, adapter, eventId, event);
      // Исходный JSON события после обработки не хранится: данные уже разложены по таблицам.
      await db.query("UPDATE chat_events SET status = 'done', payload = NULL, error = NULL, processed_at = now() WHERE id = $1", [eventId]);
      return result;
    });
  } catch (error) {
    console.error(`[${adapter.channel}] event processing failed:`, errorText(error));
    await query("UPDATE chat_events SET status = 'failed', error = $2 WHERE id = $1", [eventId, errorText(error)]).catch(() => {});
    return;
  }
  await runAfterCommit(after);
}

// --- Отправка ---

export type SendOutcome = { status: "sent" | "failed" | "unknown" | "skipped"; error?: string };

type StoredAttachment = { type: string; buttons?: BotButton[][] };

/** Отправляет сообщение из очереди через адаптер канала. Захват атомарный — двойной отправки нет. */
export async function sendOutboxMessage(messageId: string): Promise<SendOutcome> {
  const claimed = await query<{
    text: string;
    attachments: StoredAttachment[] | null;
    channel: string;
    external_user_id: string;
    chat_id: string | null;
    bot_blocked: boolean;
    client_id: string;
  }>(
    `UPDATE chat_messages m SET status = 'sending', attempts = m.attempts + 1, claimed_at = now(), error = NULL
     FROM chat_clients c
     WHERE m.id = $1 AND m.status = 'pending' AND m.direction = 'out' AND c.id = m.client_id
     RETURNING m.text, m.attachments, c.channel, c.external_user_id, c.chat_id, c.bot_blocked, m.client_id`,
    [messageId],
  );
  const row = claimed[0];
  if (!row) return { status: "skipped" };
  if (!isChannel(row.channel)) return { status: "skipped" };
  const adapter = getAdapter(row.channel);

  if (row.bot_blocked) {
    const error = `Клиент остановил бота или удалил чат — ${channelLabels[row.channel]} не доставит сообщение до нового обращения клиента.`;
    await query("UPDATE chat_messages SET status = 'failed', error = $2 WHERE id = $1", [messageId, error]);
    return { status: "failed", error };
  }

  const keyboard = row.attachments?.find((a) => a.type === "inline_keyboard" && a.buttons);
  const externalUserId = Number(row.external_user_id);
  const chatId = row.chat_id === null ? null : Number(row.chat_id);

  try {
    const sent = await adapter.send(
      { externalUserId, chatId },
      {
        text: row.text,
        buttons: keyboard?.buttons,
        removeKeyboard: Boolean(row.attachments?.some((a) => a.type === "remove_keyboard")),
      },
    );
    try {
      await query(
        `UPDATE chat_messages SET status = 'sent', external_mid = $2, external_message_id = $3, external_chat_id = $4,
           external_user_id = $5, sent_at = now() WHERE id = $1`,
        [messageId, sent.messageKey, sent.externalMessageId, chatId, externalUserId],
      );
    } catch {
      await query("UPDATE chat_messages SET status = 'sent', sent_at = now() WHERE id = $1", [messageId]);
    }
    await query(
      `UPDATE chat_clients SET last_message_at = now(), last_message_preview = $2, last_message_direction = 'out', updated_at = now() WHERE id = $1`,
      [row.client_id, preview(row.text)],
    );
    return { status: "sent" };
  } catch (error) {
    const unknown = error instanceof ChannelApiError && error.kind === "unknown";
    const text = errorText(error);
    console.error(`[${adapter.channel}] send failed (${unknown ? "result unknown" : "not delivered"}):`, text);
    await query("UPDATE chat_messages SET status = $2, error = $3 WHERE id = $1", [messageId, unknown ? "unknown" : "failed", text]);
    if (error instanceof ChannelApiError && error.blocked) {
      await query("UPDATE chat_clients SET bot_blocked = true, updated_at = now() WHERE id = $1", [row.client_id]);
    }
    return { status: unknown ? "unknown" : "failed", error: text };
  }
}

// --- Фоновая проверка ---

let sweeping = false;

/**
 * Досылает то, что не завершилось из-за перезапуска или сбоя: необработанные события и
 * сообщения, оставшиеся в очереди. Зависшая отправка помечается как unknown (без повтора).
 */
export async function sweepChats(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    await query(
      `UPDATE chat_messages SET status = 'unknown', error = 'Отправка прервана (перезапуск сервера); результат неизвестен.'
       WHERE status = 'sending' AND claimed_at < now() - interval '2 minutes'`,
    );
    await query(
      `UPDATE chat_events SET status = 'failed', error = 'Обработка прервана (перезапуск сервера).'
       WHERE status = 'processing' AND claimed_at < now() - interval '2 minutes'`,
    );
    const events = await query<{ id: string }>(
      `SELECT id FROM chat_events
       WHERE (status = 'pending' AND received_at < now() - interval '30 seconds')
          OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS} AND coalesce(claimed_at, received_at) < now() - interval '1 minute')
       ORDER BY id LIMIT 50`,
    );
    for (const event of events) await processEvent(String(event.id));
    const messages = await query<{ id: string }>(
      `SELECT id FROM chat_messages WHERE status = 'pending' AND direction = 'out' AND created_at < now() - interval '1 minute'
       ORDER BY id LIMIT 50`,
    );
    for (const message of messages) await sendOutboxMessage(String(message.id));

    // Минимизация: исходный JSON событий, которые не удалось обработать, хранится не дольше 7 дней,
    // служебные записи о событиях (без содержимого) — 30 дней; для защиты от повторной доставки этого достаточно.
    await query(
      `UPDATE chat_events SET payload = NULL
       WHERE payload IS NOT NULL AND status = 'failed' AND attempts >= ${MAX_ATTEMPTS} AND received_at < now() - interval '7 days'`,
    );
    await query(`DELETE FROM chat_events WHERE status IN ('done', 'ignored') AND received_at < now() - interval '30 days'`);
  } catch (error) {
    console.error("[chat] background check failed:", errorText(error));
  } finally {
    sweeping = false;
  }
}
