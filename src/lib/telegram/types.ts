import type { AttachmentMeta, ChatUser, IncomingEvent } from "@/lib/chat/types";

/**
 * Разбор Update Telegram (подмножество Bot API) в общий вид. Модуль без зависимостей от сервера.
 * Обрабатываются только личные чаты с ботом: группы и каналы игнорируются.
 */

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type?: string };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  caption?: string;
  contact?: { phone_number?: string; user_id?: number };
  photo?: { file_size?: number }[];
  document?: { file_name?: string; file_size?: number; mime_type?: string };
  video?: { file_size?: number; mime_type?: string };
  audio?: { file_name?: string; file_size?: number; mime_type?: string };
  voice?: { file_size?: number; mime_type?: string };
  video_note?: { file_size?: number };
  animation?: { file_name?: string; file_size?: number; mime_type?: string };
  sticker?: unknown;
  location?: unknown;
  venue?: unknown;
  poll?: unknown;
  dice?: unknown;
};

const MAX_TEXT = 4000;
// Типы вложений, которые фиксируются в истории (без file_id и ссылок на файлы).
const MEDIA_KEYS = ["photo", "document", "video", "audio", "voice", "video_note", "animation", "sticker", "location", "venue", "poll", "dice"] as const;

function toDate(seconds: unknown): Date | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}

function isUser(value: unknown): value is TgUser {
  return !!value && typeof value === "object" && typeof (value as TgUser).id === "number";
}

function toChatUser(user: TgUser): ChatUser {
  return {
    id: user.id,
    firstName: (user.first_name ?? "").slice(0, 200),
    lastName: (user.last_name ?? "").slice(0, 200),
    username: user.username ? user.username.slice(0, 200) : null,
    isBot: Boolean(user.is_bot),
  };
}

function attachments(message: TgMessage): AttachmentMeta[] {
  const items: AttachmentMeta[] = [];
  for (const key of MEDIA_KEYS) {
    const value = message[key];
    if (!value) continue;
    const meta: AttachmentMeta = { type: key === "photo" ? "image" : key };
    const file = (Array.isArray(value) ? value.at(-1) : value) as { file_name?: unknown; file_size?: unknown; mime_type?: unknown };
    if (file && typeof file === "object") {
      if (typeof file.file_name === "string") meta.filename = file.file_name.slice(0, 200);
      if (typeof file.file_size === "number") meta.size = file.file_size;
      if (typeof file.mime_type === "string") meta.mime = file.mime_type.slice(0, 100);
    }
    items.push(meta);
  }
  if (message.contact) items.push({ type: "contact" });
  return items;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Тип события Telegram для журнала: первое поле Update, кроме update_id. */
export function telegramUpdateType(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "unknown";
  return Object.keys(raw).find((key) => key !== "update_id")?.slice(0, 64) ?? "unknown";
}

export function parseTelegramUpdate(raw: unknown): IncomingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const update = raw as { update_id?: unknown; message?: TgMessage; callback_query?: unknown; my_chat_member?: unknown };
  if (typeof update.update_id !== "number" || !Number.isSafeInteger(update.update_id)) return null;
  // update_id уникален и возрастает — ключ защиты от повторной доставки.
  const key = `tg:${update.update_id}`;
  const type = telegramUpdateType(raw);

  if (update.message) {
    const message = update.message;
    const from = message.from;
    const time = toDate(message.date);
    if (!isUser(from) || !time || typeof message.message_id !== "number" || typeof message.chat?.id !== "number") {
      return { kind: "ignored", reason: "incomplete", updateType: type, userId: null, time, key };
    }
    if (from.is_bot) return { kind: "ignored", reason: "from_bot", updateType: type, userId: from.id, time, key };
    if (message.chat.type !== "private") return { kind: "ignored", reason: "not_private", updateType: type, userId: from.id, time, key };

    const user = toChatUser(from);
    const chatId = message.chat.id;
    const text = (message.text ?? message.caption ?? "").slice(0, MAX_TEXT);
    const start = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/i.exec(message.text ?? "");
    if (start) {
      const payload = start[1] && /^[\w-]{1,64}$/.test(start[1]) ? start[1] : null;
      return { kind: "start", user, chatId, payload, time, key };
    }
    // Номер принимается только из собственного контакта пользователя (кнопка «Отправить мой номер»),
    // а не из пересланной чужой карточки.
    const contactPhone = message.contact && message.contact.user_id === from.id ? normalizePhone(message.contact.phone_number) : null;
    return {
      kind: "message",
      user,
      chatId,
      messageKey: `tg:${chatId}:${message.message_id}`,
      messageId: String(message.message_id),
      text,
      attachments: attachments(message),
      contactPhone,
      time,
      key,
    };
  }

  if (update.callback_query && typeof update.callback_query === "object") {
    const query = update.callback_query as { id?: unknown; from?: unknown; data?: unknown; message?: TgMessage };
    const from = query.from;
    if (typeof query.id !== "string" || !isUser(from)) return { kind: "ignored", reason: "incomplete", updateType: type, userId: null, time: null, key };
    if (from.is_bot) return { kind: "ignored", reason: "from_bot", updateType: type, userId: from.id, time: null, key };
    const message = query.message;
    if (message?.chat?.type && message.chat.type !== "private") {
      return { kind: "ignored", reason: "not_private", updateType: type, userId: from.id, time: null, key };
    }
    return {
      kind: "callback",
      user: toChatUser(from),
      chatId: typeof message?.chat?.id === "number" ? message.chat.id : from.id,
      callbackId: query.id.slice(0, 200),
      payload: typeof query.data === "string" ? query.data.slice(0, 64) : "",
      sourceText: typeof message?.text === "string" ? message.text.slice(0, MAX_TEXT) : null,
      sourceMessageId: typeof message?.message_id === "number" ? String(message.message_id) : null,
      // У callback_query нет даты: используется время получения.
      time: new Date(),
      key,
    };
  }

  if (update.my_chat_member && typeof update.my_chat_member === "object") {
    const change = update.my_chat_member as {
      chat?: TgChat;
      from?: unknown;
      date?: unknown;
      old_chat_member?: { status?: unknown };
      new_chat_member?: { status?: unknown };
    };
    const from = change.from;
    const time = toDate(change.date);
    if (!isUser(from) || !time || change.chat?.type !== "private") {
      return { kind: "ignored", reason: "not_private", updateType: type, userId: isUser(from) ? from.id : null, time, key };
    }
    const status = change.new_chat_member?.status;
    const user = toChatUser(from);
    if (status === "kicked") return { kind: "stop", user, chatId: change.chat.id, time, key, reason: "stopped" };
    // Разблокировка — переход из kicked в member (не первый запуск бота).
    if (status === "member" && change.old_chat_member?.status === "kicked") return { kind: "resume", user, chatId: change.chat.id, time, key };
    return { kind: "ignored", reason: "unsupported", updateType: type, userId: from.id, time, key };
  }

  return { kind: "ignored", reason: "unsupported", updateType: type, userId: null, time: null, key };
}
