import type { AttachmentMeta, BotButton, ChatUser, IncomingEvent } from "@/lib/chat/types";

/**
 * Типы MAX Bot API, которые использует сайт (подмножество официальной спецификации),
 * и разбор входящих событий в общий вид (src/lib/chat/types.ts). Модуль без зависимостей от сервера.
 */

/** Кнопки MAX совпадают с общим видом: callback, link, request_contact. */
export type MaxButton = BotButton;

export type MaxUser = {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  username?: string | null;
  is_bot?: boolean;
};

type MaxAttachment = { type?: unknown; payload?: unknown; filename?: unknown; size?: unknown };

type MaxMessage = {
  sender?: MaxUser | null;
  recipient?: { chat_id?: number | null; chat_type?: string | null; user_id?: number | null } | null;
  timestamp?: number;
  body?: { mid?: string; text?: string | null; attachments?: MaxAttachment[] | null } | null;
};

export type { AttachmentMeta, IncomingEvent };

function toChatUser(user: MaxUser): ChatUser {
  return {
    id: user.user_id,
    firstName: (user.first_name ?? user.name ?? "").slice(0, 200),
    lastName: (user.last_name ?? "").slice(0, 200),
    username: user.username ? user.username.slice(0, 200) : null,
    isBot: Boolean(user.is_bot),
  };
}

const MAX_TEXT = 4000;

function toDate(timestamp: unknown): Date | null {
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : null;
}

function isUser(value: unknown): value is MaxUser {
  return !!value && typeof value === "object" && typeof (value as MaxUser).user_id === "number";
}

/** Телефон из визитки (vCard), которую MAX присылает по кнопке «Поделиться контактом». */
export function phoneFromVcf(vcf: unknown): string | null {
  if (typeof vcf !== "string") return null;
  const line = vcf.split(/\r?\n/).find((item) => /^TEL[;:]/i.test(item));
  const value = line?.slice(line.indexOf(":") + 1).trim() ?? "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? (value.startsWith("+") ? `+${digits}` : digits) : null;
}

function attachmentMeta(list: MaxAttachment[] | null | undefined): { items: AttachmentMeta[]; contactPhone: string | null } {
  const items: AttachmentMeta[] = [];
  let contactPhone: string | null = null;
  for (const item of list ?? []) {
    const type = typeof item?.type === "string" ? item.type.slice(0, 32) : "unknown";
    const meta: AttachmentMeta = { type };
    if (typeof item.filename === "string") meta.filename = item.filename.slice(0, 200);
    if (typeof item.size === "number") meta.size = item.size;
    if (type === "contact" && item.payload && typeof item.payload === "object") {
      contactPhone = phoneFromVcf((item.payload as { vcf_info?: unknown }).vcf_info) ?? contactPhone;
    }
    items.push(meta);
  }
  return { items, contactPhone };
}

/**
 * Ключ события для защиты от повторной доставки. У сообщения — его mid, у нажатия — callback_id,
 * у остальных событий — тип, пользователь и время события.
 */
function fallbackKey(type: string, userId: number | null, timestamp: unknown): string {
  return `${type}:${userId ?? "-"}:${typeof timestamp === "number" ? timestamp : "-"}`;
}

/** Разбор события Webhook. Неподдерживаемые и неполные события помечаются как ignored. */
export function parseUpdate(raw: unknown): IncomingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const update = raw as Record<string, unknown>;
  const type = typeof update.update_type === "string" ? update.update_type.slice(0, 64) : null;
  if (!type) return null;
  const time = toDate(update.timestamp);

  if (type === "bot_started" || type === "bot_stopped" || type === "dialog_removed") {
    const user = update.user;
    if (!isUser(user) || !time) return { kind: "ignored", reason: "incomplete", updateType: type, userId: null, time, key: fallbackKey(type, null, update.timestamp) };
    const chatId = typeof update.chat_id === "number" ? update.chat_id : null;
    const key = fallbackKey(type, user.user_id, update.timestamp);
    if (type === "bot_started") {
      const payload = typeof update.payload === "string" && update.payload ? update.payload.slice(0, 200) : null;
      return { kind: "start", user: toChatUser(user), chatId, payload, time, key };
    }
    return { kind: "stop", user: toChatUser(user), chatId, time, key, reason: type === "bot_stopped" ? "stopped" : "removed" };
  }

  if (type === "message_created") {
    const message = update.message as MaxMessage | undefined;
    const sender = message?.sender;
    const mid = typeof message?.body?.mid === "string" ? message.body.mid.slice(0, 200) : null;
    const key = mid ? `message:${mid}` : fallbackKey(type, isUser(sender) ? sender.user_id : null, update.timestamp);
    if (!isUser(sender) || !time) return { kind: "ignored", reason: "incomplete", updateType: type, userId: null, time, key };
    // Собственные сообщения бота и сообщения других ботов не обрабатываются — защита от циклов.
    if (sender.is_bot) return { kind: "ignored", reason: "from_bot", updateType: type, userId: sender.user_id, time, key };
    if (message?.recipient?.chat_type && message.recipient.chat_type !== "dialog") {
      return { kind: "ignored", reason: "not_dialog", updateType: type, userId: sender.user_id, time, key };
    }
    const { items, contactPhone } = attachmentMeta(message?.body?.attachments);
    return {
      kind: "message",
      user: toChatUser(sender),
      chatId: message?.recipient?.chat_id ?? null,
      messageKey: mid,
      messageId: mid,
      text: (message?.body?.text ?? "").slice(0, MAX_TEXT),
      attachments: items,
      contactPhone,
      time,
      key,
    };
  }

  if (type === "message_callback") {
    const callback = update.callback as { callback_id?: unknown; payload?: unknown; user?: unknown; timestamp?: unknown } | undefined;
    const callbackId = typeof callback?.callback_id === "string" ? callback.callback_id.slice(0, 200) : null;
    const user = callback?.user;
    const key = callbackId ? `callback:${callbackId}` : fallbackKey(type, null, update.timestamp);
    if (!callbackId || !isUser(user) || !time) return { kind: "ignored", reason: "incomplete", updateType: type, userId: null, time, key };
    if (user.is_bot) return { kind: "ignored", reason: "from_bot", updateType: type, userId: user.user_id, time, key };
    const message = update.message as MaxMessage | null | undefined;
    if (message?.recipient?.chat_type && message.recipient.chat_type !== "dialog") {
      return { kind: "ignored", reason: "not_dialog", updateType: type, userId: user.user_id, time, key };
    }
    return {
      kind: "callback",
      user: toChatUser(user),
      chatId: message?.recipient?.chat_id ?? null,
      callbackId,
      payload: typeof callback?.payload === "string" ? callback.payload.slice(0, 200) : "",
      sourceText: typeof message?.body?.text === "string" ? message.body.text.slice(0, MAX_TEXT) : null,
      sourceMessageId: typeof message?.body?.mid === "string" ? message.body.mid.slice(0, 200) : null,
      time,
      key,
    };
  }

  const user = isUser(update.user) ? update.user.user_id : null;
  return { kind: "ignored", reason: "unsupported", updateType: type, userId: user, time, key: fallbackKey(type, user, update.timestamp) };
}

/** Отображаемое имя пользователя MAX. */
export function maxDisplayName(user: { first_name?: string | null; last_name?: string | null; username?: string | null; name?: string | null }): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return full || user.name?.trim() || (user.username ? `@${user.username}` : "");
}

/** Тип события MAX для журнала. */
export function maxUpdateType(raw: unknown): string {
  const type = raw && typeof raw === "object" ? (raw as { update_type?: unknown }).update_type : null;
  return typeof type === "string" ? type.slice(0, 64) : "unknown";
}
