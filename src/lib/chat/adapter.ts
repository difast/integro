import type { BotReply, Step } from "./scenario";
import type { BotButton, Channel, IncomingEvent } from "./types";

export type OutgoingMessage = { text: string; buttons?: BotButton[][]; removeKeyboard?: boolean };

/** Подключение канала к общей системе обращений. */
export interface ChannelAdapter {
  channel: Channel;
  /** Название для текстов: «чат-бот MAX», «Telegram-бот». */
  botTitle: string;
  /** Канал настроен (токен и секрет Webhook заданы). */
  isEnabled(): boolean;
  /** Событие платформы → общий вид. null — не событие этой платформы. */
  parse(raw: unknown): IncomingEvent | null;
  /** Тип события платформы — для журнала событий. */
  updateType(raw: unknown): string;
  /** Отправка сообщения пользователю. Ошибки — ChannelApiError. */
  send(target: { externalUserId: number; chatId: number | null }, message: OutgoingMessage): Promise<{ externalMessageId: string | null; messageKey: string | null }>;
  /** Ответ на нажатие кнопки: уведомление и (по возможности) снятие клавиатуры с нажатого сообщения. */
  acknowledgeCallback(
    event: Extract<IncomingEvent, { kind: "callback" }>,
    options: { notification?: string; clearKeyboard: boolean },
  ): Promise<void>;
  /** Особенности платформы при смене шага сценария (например, убрать клавиатуру Telegram). */
  adaptReplies?(previous: Step, next: Step, replies: BotReply[]): BotReply[];
}
