import type { ChannelAdapter } from "@/lib/chat/adapter";

/**
 * Онлайн-чат на сайте в общей системе обращений. Внешней платформы нет: «отправка» ответа оператора —
 * это подтверждение, что сообщение сохранено и отдаётся виджету посетителя при следующем опросе
 * (GET /api/webchat). Входящие сообщения принимает /api/webchat/messages, а не Webhook.
 */
export const webAdapter: ChannelAdapter = {
  channel: "web",
  botTitle: "онлайн-чат на сайте",
  isEnabled: () => true,
  parse: () => null,
  updateType: () => "web",
  send: async () => ({ externalMessageId: null, messageKey: null }),
  acknowledgeCallback: async () => {},
};
