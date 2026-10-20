import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { company } from "@/config/company";
import { botButtons, botDirections, botTexts } from "@/config/max-bot";
import { getService } from "@/config/services";
import { describeDbError, query, withTransaction } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { searchDigits } from "@/lib/requests/filters";
import { createRequest } from "@/lib/requests/repository";
import { absoluteUrl } from "@/lib/site";
import { MaxApiError, maxApi, type MaxOutgoingBody } from "./api";
import { directionLabel, runScenario, type BotInput, type BotReply } from "./scenario";
import { maxDisplayName, parseUpdate, type AttachmentMeta, type IncomingEvent, type MaxButton } from "./types";

/**
 * Обработка событий MAX и отправка сообщений.
 *
 * 1. Webhook сохраняет событие в max_events (уникальный ключ — защита от повторной доставки)
 *    и сразу отвечает MAX.
 * 2. processEvent в одной транзакции: обновляет карточку клиента, сохраняет входящее сообщение,
 *    выполняет сценарий, создаёт заявку и ставит ответы в очередь (max_messages, status=pending).
 *    Повторная обработка того же события невозможна: событие захватывается атомарно.
 * 3. После фиксации транзакции ответы отправляются по одному (sendOutboxMessage). Каждое сообщение
 *    отправляется не более одного раза автоматически: при неизвестном результате (тайм-аут) оно
 *    получает статус unknown и повторяется только вручную из админки.
 */

const MAX_ATTEMPTS = 5;
/** Защита от циклов и лавины ответов: не больше стольких автоответов клиенту в минуту. */
const BOT_REPLIES_PER_MINUTE = 15;

type ClientRow = {
  id: string;
  max_user_id: string;
  mode: "bot" | "operator";
  status: "open" | "closed";
  flow_state: unknown;
  consent_revision: string | null;
  bot_blocked: boolean;
  source: string | null;
};

function errorText(error: unknown): string {
  if (error instanceof MaxApiError) return error.summary;
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

/** Сохраняет событие. false — такое событие уже было получено (повторная доставка). */
export async function storeEvent(raw: unknown): Promise<{ id: string; duplicate: boolean } | null> {
  const event = parseUpdate(raw);
  if (!event) return null;
  const userId = event.kind === "ignored" ? event.userId : event.user.user_id;
  const updateType = event.kind === "ignored" ? event.updateType : ((raw as { update_type: string }).update_type);
  const rows = await query<{ id: string }>(
    `INSERT INTO max_events (event_key, update_type, max_user_id, event_time, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [
      event.key,
      updateType,
      userId,
      event.time,
      event.kind === "ignored" ? null : JSON.stringify(raw),
      event.kind === "ignored" ? "ignored" : "pending",
    ],
  );
  if (rows[0]) return { id: rows[0].id, duplicate: false };
  return { id: "", duplicate: true };
}

// --- Обработка события ---

type AfterCommit = {
  outbox: string[];
  callback: { id: string; body: { message?: MaxOutgoingBody; notification?: string } } | null;
  notify: { requestId: string; number: string; summary: string[] } | null;
};

async function upsertClient(db: PoolClient, event: Exclude<IncomingEvent, { kind: "ignored" }>): Promise<ClientRow> {
  const user = event.user;
  const source = event.kind === "start" ? event.payload : null;
  await db.query(
    `INSERT INTO max_clients (max_user_id, chat_id, first_name, last_name, username, source, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (max_user_id) DO UPDATE SET
       chat_id = coalesce(EXCLUDED.chat_id, max_clients.chat_id),
       first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE max_clients.first_name END,
       last_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.last_name ELSE max_clients.last_name END,
       username = coalesce(EXCLUDED.username, max_clients.username),
       source = coalesce(max_clients.source, EXCLUDED.source),
       last_seen_at = greatest(max_clients.last_seen_at, EXCLUDED.last_seen_at),
       updated_at = now()`,
    [
      user.user_id,
      event.chatId,
      (user.first_name ?? user.name ?? "").slice(0, 200),
      (user.last_name ?? "").slice(0, 200),
      user.username ? user.username.slice(0, 200) : null,
      source,
      event.time,
    ],
  );
  const { rows } = await db.query<ClientRow>(
    `SELECT id, max_user_id, mode, status, flow_state, consent_revision, bot_blocked, source
     FROM max_clients WHERE max_user_id = $1 FOR UPDATE`,
    [user.user_id],
  );
  return rows[0]!;
}

async function insertIncoming(
  db: PoolClient,
  clientId: string,
  eventId: string,
  event: Exclude<IncomingEvent, { kind: "ignored" }>,
): Promise<boolean> {
  let kind: string = event.kind;
  let text = "";
  let attachments: AttachmentMeta[] | null = null;
  let mid: string | null = null;
  if (event.kind === "start") text = event.payload ? `Запуск бота (метка: ${event.payload})` : "Запуск бота";
  if (event.kind === "stop") text = event.updateType === "bot_stopped" ? "Клиент остановил бота" : "Клиент удалил диалог с ботом";
  if (event.kind === "callback") text = `Нажата кнопка «${callbackLabel(event.payload)}»`;
  if (event.kind === "message") {
    mid = event.mid;
    text = event.text;
    attachments = event.attachments.length ? event.attachments : null;
    kind = event.contactPhone ? "contact" : event.attachments.length && !event.text ? "attachment" : "text";
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO max_messages (client_id, direction, author, kind, text, attachments, external_mid, event_id, status, event_time)
     VALUES ($1, 'in', 'client', $2, $3, $4, $5, $6, 'received', $7)
     ON CONFLICT (external_mid) DO NOTHING
     RETURNING id`,
    [clientId, kind, text.slice(0, 4000), attachments ? JSON.stringify(attachments) : null, mid, eventId, event.time],
  );
  if (!rows[0]) return false;
  if (event.kind !== "stop") {
    await db.query(
      `UPDATE max_clients SET last_message_at = $2, last_message_preview = $3, last_message_direction = 'in',
         status = 'open', updated_at = now() WHERE id = $1`,
      [clientId, event.time, preview(text) || "(вложение)"],
    );
  }
  return true;
}

async function queueReply(db: PoolClient, clientId: string, reply: BotReply, author: "bot" | "operator" = "bot"): Promise<string> {
  const attachments = reply.buttons ? [{ type: "inline_keyboard", buttons: reply.buttons }] : null;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO max_messages (client_id, direction, author, kind, text, attachments, idempotency_key, status)
     VALUES ($1, 'out', $2, 'text', $3, $4, $5, 'pending') RETURNING id`,
    [clientId, author, reply.text.slice(0, 4000), attachments ? JSON.stringify(attachments) : null, randomUUID()],
  );
  return rows[0]!.id;
}

function toBotInput(event: Exclude<IncomingEvent, { kind: "ignored" | "stop" }>): BotInput {
  if (event.kind === "start") return { type: "start" };
  if (event.kind === "callback") return { type: "callback", payload: event.payload };
  if (event.contactPhone !== null || event.attachments.some((a) => a.type === "contact")) return { type: "contact", phone: event.contactPhone };
  if (!event.text && event.attachments.length) return { type: "attachment" };
  return { type: "text", text: event.text };
}

async function handleEvent(db: PoolClient, eventId: string, event: Exclude<IncomingEvent, { kind: "ignored" }>): Promise<AfterCommit> {
  const after: AfterCommit = { outbox: [], callback: null, notify: null };
  const client = await upsertClient(db, event);
  const fresh = await insertIncoming(db, client.id, eventId, event);
  if (!fresh) return after;

  if (event.kind === "stop") {
    await db.query("UPDATE max_clients SET bot_blocked = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }
  if (event.kind === "start" && client.bot_blocked) {
    await db.query("UPDATE max_clients SET bot_blocked = false, updated_at = now() WHERE id = $1", [client.id]);
  }

  // Ответ на нажатие: старая клавиатура убирается из сообщения, чтобы её нельзя было нажать повторно.
  if (event.kind === "callback") {
    after.callback = {
      id: event.callbackId,
      body:
        client.mode === "operator"
          ? { notification: botTexts.operatorMode }
          : event.sourceText
            ? { message: { text: event.sourceText, attachments: [] } }
            : { notification: callbackLabel(event.payload) },
    };
  }

  // Режим оператора: бот молчит, диалог помечается как требующий ответа.
  if (client.mode === "operator") {
    await db.query("UPDATE max_clients SET needs_reply = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }

  const { rows: recent } = await db.query<{ count: string }>(
    `SELECT count(*) AS count FROM max_messages
     WHERE client_id = $1 AND direction = 'out' AND author = 'bot' AND created_at > now() - interval '1 minute'`,
    [client.id],
  );
  if (Number(recent[0]?.count ?? 0) >= BOT_REPLIES_PER_MINUTE) {
    console.warn("[max] auto-reply limit reached for a client, waiting for an operator");
    await db.query("UPDATE max_clients SET needs_reply = true, updated_at = now() WHERE id = $1", [client.id]);
    return after;
  }

  const result = runScenario(client.flow_state, toBotInput(event), {
    hasConsent: client.consent_revision === company.legalRevisionDate,
    newKey: randomUUID,
  });

  const replies = [...result.replies];
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
        context: "Чат-бот MAX",
        consentRevision: client.consent_revision ?? company.legalRevisionDate,
        channel: "max",
        maxClientId: client.id,
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

  await db.query(
    `UPDATE max_clients SET
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

/** Короткий номер заявки для клиента: первые 8 символов идентификатора. */
export function requestNumber(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function runAfterCommit(after: AfterCommit): Promise<void> {
  if (after.callback) {
    try {
      await maxApi.answerCallback(after.callback.id, after.callback.body);
    } catch (error) {
      console.warn("[max] callback answer failed:", errorText(error));
    }
  }
  for (const id of after.outbox) await sendOutboxMessage(id);

  if (after.notify && isMailConfigured()) {
    const link = absoluteUrl(`/admin/zayavki/${after.notify.requestId}`);
    try {
      await sendMail({
        subject: `Заявка из чат-бота MAX № ${after.notify.number}`,
        text: [
          `Новая заявка из чат-бота MAX ${company.legalName}`,
          "",
          ...after.notify.summary,
          "",
          `Клиент дал согласие на обработку персональных данных в чат-боте (редакция от ${company.legalRevisionDate}).`,
          ...(link ? ["", `Заявка в панели администратора: ${link}`] : []),
        ].join("\n"),
      });
    } catch (error) {
      console.error("[max] request saved, notification email failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}

/**
 * Обрабатывает сохранённое событие. Безопасно вызывать повторно и параллельно:
 * событие захватывается атомарно, обработанное повторно не выполняется.
 */
export async function processEvent(eventId: string): Promise<void> {
  const claimed = await query<{ payload: unknown }>(
    `UPDATE max_events SET status = 'processing', attempts = attempts + 1, claimed_at = now()
     WHERE id = $1 AND status IN ('pending', 'failed') AND attempts < ${MAX_ATTEMPTS}
     RETURNING payload`,
    [eventId],
  );
  if (!claimed[0]) return;

  const event = parseUpdate(claimed[0].payload);
  if (!event || event.kind === "ignored") {
    await query("UPDATE max_events SET status = 'ignored', payload = NULL, processed_at = now() WHERE id = $1", [eventId]);
    return;
  }

  let after: AfterCommit;
  try {
    after = await withTransaction(async (db) => {
      const result = await handleEvent(db, eventId, event);
      // Исходный JSON события после обработки не хранится: данные уже разложены по таблицам.
      await db.query("UPDATE max_events SET status = 'done', payload = NULL, error = NULL, processed_at = now() WHERE id = $1", [eventId]);
      return result;
    });
  } catch (error) {
    console.error("[max] event processing failed:", errorText(error));
    await query("UPDATE max_events SET status = 'failed', error = $2 WHERE id = $1", [eventId, errorText(error)]).catch(() => {});
    return;
  }
  await runAfterCommit(after);
}

// --- Отправка ---

export type SendOutcome = { status: "sent" | "failed" | "unknown" | "skipped"; error?: string };

/** Отправляет сообщение из очереди. Сообщение захватывается атомарно — двойной отправки нет. */
export async function sendOutboxMessage(messageId: string): Promise<SendOutcome> {
  const claimed = await query<{ text: string; attachments: { type: string; buttons?: MaxButton[][] }[] | null; max_user_id: string; bot_blocked: boolean; client_id: string }>(
    `UPDATE max_messages m SET status = 'sending', attempts = m.attempts + 1, claimed_at = now(), error = NULL
     FROM max_clients c
     WHERE m.id = $1 AND m.status = 'pending' AND m.direction = 'out' AND c.id = m.client_id
     RETURNING m.text, m.attachments, c.max_user_id, c.bot_blocked, m.client_id`,
    [messageId],
  );
  const row = claimed[0];
  if (!row) return { status: "skipped" };

  if (row.bot_blocked) {
    const error = "Клиент остановил бота или удалил диалог — MAX не доставит сообщение до нового обращения клиента.";
    await query("UPDATE max_messages SET status = 'failed', error = $2 WHERE id = $1", [messageId, error]);
    return { status: "failed", error };
  }

  const keyboard = row.attachments?.find((a) => a.type === "inline_keyboard" && a.buttons);
  const body: MaxOutgoingBody = {
    text: row.text,
    ...(keyboard?.buttons ? { attachments: [{ type: "inline_keyboard", payload: { buttons: keyboard.buttons } }] } : {}),
  };

  try {
    const response = await maxApi.sendToUser(Number(row.max_user_id), body);
    const mid = typeof response?.message?.body?.mid === "string" ? response.message.body.mid.slice(0, 200) : null;
    try {
      await query("UPDATE max_messages SET status = 'sent', external_mid = $2, sent_at = now() WHERE id = $1", [messageId, mid]);
    } catch {
      await query("UPDATE max_messages SET status = 'sent', sent_at = now() WHERE id = $1", [messageId]);
    }
    await query(
      `UPDATE max_clients SET last_message_at = now(), last_message_preview = $2, last_message_direction = 'out', updated_at = now() WHERE id = $1`,
      [row.client_id, preview(row.text)],
    );
    return { status: "sent" };
  } catch (error) {
    const unknown = error instanceof MaxApiError && error.kind === "unknown";
    const text = errorText(error);
    console.error(`[max] send failed (${unknown ? "result unknown" : "not delivered"}):`, text);
    await query("UPDATE max_messages SET status = $2, error = $3 WHERE id = $1", [messageId, unknown ? "unknown" : "failed", text]);
    return { status: unknown ? "unknown" : "failed", error: text };
  }
}

// --- Фоновая проверка ---

let sweeping = false;

/**
 * Досылает то, что не завершилось из-за перезапуска или сбоя: необработанные события и
 * сообщения, оставшиеся в очереди. Зависшая отправка помечается как unknown (без повтора).
 */
export async function sweepMax(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    await query(
      `UPDATE max_messages SET status = 'unknown', error = 'Отправка прервана (перезапуск сервера); результат неизвестен.'
       WHERE status = 'sending' AND claimed_at < now() - interval '2 minutes'`,
    );
    await query(
      `UPDATE max_events SET status = 'failed', error = 'Обработка прервана (перезапуск сервера).'
       WHERE status = 'processing' AND claimed_at < now() - interval '2 minutes'`,
    );
    const events = await query<{ id: string }>(
      `SELECT id FROM max_events
       WHERE (status = 'pending' AND received_at < now() - interval '30 seconds')
          OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS} AND coalesce(claimed_at, received_at) < now() - interval '1 minute')
       ORDER BY id LIMIT 50`,
    );
    for (const event of events) await processEvent(event.id);
    const messages = await query<{ id: string }>(
      `SELECT id FROM max_messages WHERE status = 'pending' AND direction = 'out' AND created_at < now() - interval '1 minute'
       ORDER BY id LIMIT 50`,
    );
    for (const message of messages) await sendOutboxMessage(message.id);

    // Минимизация: исходный JSON событий, которые не удалось обработать, хранится не дольше 7 дней,
    // служебные записи о событиях (без содержимого) — 30 дней; для защиты от повторной доставки этого достаточно.
    await query(
      `UPDATE max_events SET payload = NULL
       WHERE payload IS NOT NULL AND status = 'failed' AND attempts >= ${MAX_ATTEMPTS} AND received_at < now() - interval '7 days'`,
    );
    await query(
      `DELETE FROM max_events WHERE status IN ('done', 'ignored') AND received_at < now() - interval '30 days'`,
    );
  } catch (error) {
    console.error("[max] background check failed:", errorText(error));
  } finally {
    sweeping = false;
  }
}

export { maxDisplayName };
