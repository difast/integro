import "server-only";
import { botTexts } from "@/config/chat-bot";
import type { ChannelAdapter } from "@/lib/chat/adapter";
import type { BotReply } from "@/lib/chat/scenario";
import type { BotButton } from "@/lib/chat/types";
import { telegramApi, type TelegramReplyMarkup } from "./api";
import { getTelegramConfig, isTelegramEnabled } from "./config";
import { parseTelegramUpdate, telegramUpdateType } from "./types";

/**
 * Кнопки → разметка Telegram. Обычные кнопки — InlineKeyboardMarkup (callback_data, до 64 байт).
 * Кнопка «Отправить мой номер» в Telegram существует только в обычной клавиатуре (ReplyKeyboardMarkup
 * с request_contact), поэтому сообщение с ней получает обычную клавиатуру: остальные кнопки становятся
 * текстовыми, а сценарий распознаёт их подписи.
 */
export function toTelegramMarkup(buttons: BotButton[][] | undefined, removeKeyboard = false): TelegramReplyMarkup | undefined {
  if (buttons?.length) {
    const needsContact = buttons.some((row) => row.some((button) => button.type === "request_contact"));
    if (needsContact) {
      return {
        keyboard: buttons.map((row) =>
          row.map((button) => (button.type === "request_contact" ? { text: button.text, request_contact: true } : { text: button.text })),
        ),
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    }
    return {
      inline_keyboard: buttons.map((row) =>
        row.map((button) =>
          button.type === "link" ? { text: button.text, url: button.url } : { text: button.text, callback_data: button.type === "callback" ? button.payload : button.text },
        ),
      ),
    };
  }
  return removeKeyboard ? { remove_keyboard: true } : undefined;
}

/** Telegram как канал общей системы обращений. */
export const telegramAdapter: ChannelAdapter = {
  channel: "telegram",
  botTitle: "Telegram-бот",
  isEnabled: () => isTelegramEnabled(getTelegramConfig()),
  parse: parseTelegramUpdate,
  updateType: telegramUpdateType,

  async send(target, message) {
    // В личном чате chat_id совпадает с ID пользователя.
    const chatId = target.chatId ?? target.externalUserId;
    const sent = await telegramApi.sendMessage(chatId, message.text, toTelegramMarkup(message.buttons, message.removeKeyboard));
    const id = typeof sent?.message_id === "number" ? String(sent.message_id) : null;
    return { externalMessageId: id, messageKey: id ? `tg:${chatId}:${id}` : null };
  },

  async acknowledgeCallback(event, options) {
    await telegramApi.answerCallbackQuery(event.callbackId, options.clearKeyboard ? undefined : options.notification);
    if (options.clearKeyboard && event.chatId && event.sourceMessageId) {
      await telegramApi.clearInlineKeyboard(event.chatId, Number(event.sourceMessageId)).catch(() => {});
    }
  },

  /** После шага «телефон» обычную клавиатуру с кнопкой «Отправить мой номер» нужно убрать. */
  adaptReplies(previous, next, replies) {
    if (previous !== "phone" || next === "phone") return replies;
    const index = replies.findIndex((reply) => !reply.buttons?.length);
    if (index >= 0) return replies.map((reply, i): BotReply => (i === index ? { ...reply, removeKeyboard: true } : reply));
    return [{ text: botTexts.keyboardClosed, removeKeyboard: true }, ...replies];
  },
};
