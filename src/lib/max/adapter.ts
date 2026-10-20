import "server-only";
import type { ChannelAdapter } from "@/lib/chat/adapter";
import { maxApi, type MaxOutgoingBody } from "./api";
import { getMaxConfig, isMaxEnabled } from "./config";
import { maxUpdateType, parseUpdate } from "./types";

/** MAX как канал общей системы обращений. */
export const maxAdapter: ChannelAdapter = {
  channel: "max",
  botTitle: "чат-бот MAX",
  isEnabled: () => isMaxEnabled(getMaxConfig()),
  parse: parseUpdate,
  updateType: maxUpdateType,

  async send(target, message) {
    const body: MaxOutgoingBody = {
      text: message.text,
      ...(message.buttons?.length ? { attachments: [{ type: "inline_keyboard", payload: { buttons: message.buttons } }] } : {}),
    };
    const response = await maxApi.sendToUser(target.externalUserId, body);
    const mid = typeof response?.message?.body?.mid === "string" ? response.message.body.mid.slice(0, 200) : null;
    return { externalMessageId: mid, messageKey: mid };
  },

  async acknowledgeCallback(event, options) {
    // Клавиатура снимается заменой нажатого сообщения на тот же текст без вложений.
    if (options.clearKeyboard && event.sourceText) {
      await maxApi.answerCallback(event.callbackId, { message: { text: event.sourceText, attachments: [] } });
      return;
    }
    await maxApi.answerCallback(event.callbackId, { notification: options.notification ?? "Готово" });
  },
};
