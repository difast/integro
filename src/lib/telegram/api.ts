import "server-only";
import { ChannelApiError, withSafeRetry } from "@/lib/chat/errors";
import { postJson } from "@/lib/chat/http";
import { getTelegramConfig, type TelegramConfig } from "./config";

/**
 * Клиент Telegram Bot API (https://core.telegram.org/bots/api). Все методы — POST с JSON-телом.
 * Ответ: { ok: true, result } или { ok: false, error_code, description, parameters: { retry_after } }.
 * Токен — часть адреса запроса: адрес не выводится в журнал и не попадает в тексты ошибок.
 */

export class TelegramApiError extends ChannelApiError {
  constructor(...args: ConstructorParameters<typeof ChannelApiError>) {
    super(...args);
    this.name = "TelegramApiError";
  }

  /** 403: пользователь заблокировал бота (или бот не может писать в этот чат). */
  get blocked(): boolean {
    return this.kind === "http" && this.status === 403;
  }

  get summary(): string {
    if (this.kind === "http") return `Telegram API ${this.status}: ${this.message}`.slice(0, 300);
    return this.message.slice(0, 300);
  }
}

/** Типы событий, которые получает бот (allowed_updates). */
export const telegramAllowedUpdates = ["message", "callback_query", "my_chat_member"] as const;

export type TelegramTransport = (config: TelegramConfig, method: string, params: Record<string, unknown>) => Promise<unknown>;

const httpTransport: TelegramTransport = async (config, method, params) => {
  if (!config.token) throw new TelegramApiError("config", "Не задан TELEGRAM_BOT_TOKEN.");
  const url = new URL(`/bot${config.token}/${method}`, config.apiBaseUrl);
  let response;
  try {
    response = await postJson(url, params, { service: "Telegram API" });
  } catch (error) {
    if (error instanceof ChannelApiError) throw new TelegramApiError(error.kind, error.message, error.status, error.code, error.retryAfterMs);
    throw error;
  }
  const data = (response.data && typeof response.data === "object" ? response.data : {}) as {
    ok?: boolean;
    result?: unknown;
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number };
  };
  if (data.ok === true) return data.result;
  const status = typeof data.error_code === "number" ? data.error_code : response.status;
  const retryAfter = data.parameters?.retry_after ?? Number(response.retryAfterHeader);
  const description =
    status === 401 || status === 404
      ? "токен бота не принят (проверьте TELEGRAM_BOT_TOKEN)"
      : typeof data.description === "string"
        ? data.description.replace(/bot\d+:[\w-]+/g, "bot***")
        : `HTTP ${response.status}`;
  throw new TelegramApiError("http", description, status, null, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
};

let transport: TelegramTransport = httpTransport;

/** Подмена транспорта в тестах. */
export function setTelegramTransport(next: TelegramTransport | null): void {
  transport = next ?? httpTransport;
}

async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return (await transport(getTelegramConfig(), method, params)) as T;
}

export type TelegramInlineButton = { text: string; callback_data?: string; url?: string };
export type TelegramReplyMarkup =
  | { inline_keyboard: TelegramInlineButton[][] }
  | { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean; input_field_placeholder?: string }
  | { remove_keyboard: true };

export type TelegramSentMessage = { message_id: number; chat: { id: number }; date: number };

export const telegramApi = {
  getMe: () => call<{ id: number; is_bot: boolean; first_name: string; username?: string }>("getMe"),

  getWebhookInfo: () =>
    call<{
      url?: string;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
      allowed_updates?: string[];
    }>("getWebhookInfo"),

  /** Регистрация Webhook с секретом и списком событий. Ожидающие события не сбрасываются. */
  setWebhook: (url: string, secret: string) =>
    call<boolean>("setWebhook", { url, secret_token: secret, allowed_updates: telegramAllowedUpdates, max_connections: 10 }),

  deleteWebhook: () => call<boolean>("deleteWebhook", {}),

  /** Сообщение без разметки (parse_mode не задаётся — текст клиента не интерпретируется). */
  sendMessage: (chatId: number, text: string, replyMarkup?: TelegramReplyMarkup) =>
    withSafeRetry(() =>
      call<TelegramSentMessage>("sendMessage", {
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    ),

  answerCallbackQuery: (callbackQueryId: string, text?: string) =>
    withSafeRetry(() => call<boolean>("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text: text.slice(0, 200) } : {}) })),

  /** Снимает inline-клавиатуру с нажатого сообщения, чтобы кнопки нельзя было нажать повторно. */
  clearInlineKeyboard: (chatId: number, messageId: number) =>
    call<unknown>("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
};
