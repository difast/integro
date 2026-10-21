/**
 * Общие типы системы обращений из мессенджеров (MAX, Telegram) и онлайн-чата на сайте (web). Адаптер канала переводит
 * событие платформы в IncomingEvent, а исходящее сообщение — из общего вида в формат платформы.
 */

export const channels = ["max", "telegram", "web"] as const;
export type Channel = (typeof channels)[number];

export const channelLabels: Record<Channel, string> = { max: "MAX", telegram: "Telegram", web: "Веб-чат" };

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (channels as readonly string[]).includes(value);
}

/** Кнопка в общем виде: адаптер превращает её в кнопку платформы. */
export type BotButton =
  | { type: "callback"; text: string; payload: string }
  | { type: "link"; text: string; url: string }
  | { type: "request_contact"; text: string };

/** Пользователь платформы. id — постоянный идентификатор в канале; username может меняться. */
export type ChatUser = {
  id: number;
  firstName: string;
  lastName: string;
  username: string | null;
  isBot: boolean;
};

/** Сведения о вложении: тип и метаданные, без ссылок на файлы и токенов доступа. */
export type AttachmentMeta = { type: string; filename?: string; size?: number; mime?: string };

type Base = { user: ChatUser; chatId: number | null; time: Date; key: string };

export type IncomingEvent =
  | (Base & { kind: "start"; payload: string | null })
  | (Base & { kind: "stop"; reason: "stopped" | "removed" })
  | (Base & { kind: "resume" })
  | (Base & {
      kind: "message";
      /** Уникальный ключ сообщения во всей системе (для защиты от дублей). */
      messageKey: string | null;
      /** ID сообщения в канале. */
      messageId: string | null;
      text: string;
      attachments: AttachmentMeta[];
      contactPhone: string | null;
    })
  | (Base & {
      kind: "callback";
      callbackId: string;
      payload: string;
      sourceText: string | null;
      sourceMessageId: string | null;
    })
  | { kind: "ignored"; reason: string; updateType: string; userId: number | null; time: Date | null; key: string };

/** Отображаемое имя клиента. */
export function chatDisplayName(user: { firstName?: string | null; lastName?: string | null; username?: string | null }): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || (user.username ? `@${user.username}` : "");
}
