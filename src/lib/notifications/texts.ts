import type { NotificationType } from "@/lib/ops/settings";

export const notificationTypeLabels: Record<NotificationType, string> = {
  message: "Новое сообщение",
  needs_reply: "Ждёт ответа",
  request_site: "Заявка с сайта",
  request_bot: "Заявка из бота",
  send_failed: "Ошибка отправки",
  processing_failed: "Ошибка обработки",
  backup_failed: "Сбой резервной копии",
  system: "Система",
};

const channelNames: Record<string, string> = { max: "MAX", telegram: "Telegram", web: "веб-чат", site: "сайт", system: "система", backup: "резервная копия" };

/**
 * Текст для push и Telegram — без персональных данных клиента (имени, телефона, текста сообщения):
 * push-сервисы браузеров и Telegram — сторонние, часто иностранные сервисы. Подробности — в админке по ссылке.
 */
export function externalText(type: NotificationType, channel: string): { title: string; body: string } {
  const where = channelNames[channel] ?? channel;
  switch (type) {
    case "message":
      return { title: `Новое сообщение · ${where}`, body: "Клиент написал в чат. Откройте диалог в админке." };
    case "needs_reply":
      return { title: `Нужен ответ · ${where}`, body: "Диалог ждёт ответа оператора." };
    case "request_site":
      return { title: "Новая заявка с сайта", body: "Откройте заявку в админке." };
    case "request_bot":
      return { title: `Новая заявка · ${where}`, body: "Заявка оформлена в боте. Откройте её в админке." };
    case "send_failed":
      return { title: `Ответ не отправлен · ${where}`, body: "Проверьте статус сообщения и повторите отправку." };
    case "processing_failed":
      return { title: "Ошибка обработки обращения", body: "Событие не удалось обработать. Подробности — в разделе «Система»." };
    case "backup_failed":
      return { title: "Сбой резервного копирования", body: "Подробности — в разделе «Система»." };
    default:
      return { title: "Уведомление ООО «Интегро»", body: "Подробности — в админке." };
  }
}
