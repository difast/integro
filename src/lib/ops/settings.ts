import "server-only";
import { query } from "@/lib/db";

/**
 * Настройки, которые меняются в админке (app_settings). Секреты здесь не хранятся — только
 * в переменных окружения. Неизвестные или повреждённые значения заменяются значениями по умолчанию.
 */

export const notificationTypes = [
  { value: "message", label: "Новое сообщение от клиента (MAX, Telegram)" },
  { value: "needs_reply", label: "Диалог ждёт ответа оператора" },
  { value: "request_site", label: "Новая заявка с сайта" },
  { value: "request_bot", label: "Новая заявка из бота" },
  { value: "send_failed", label: "Ошибка отправки ответа клиенту" },
  { value: "processing_failed", label: "Критическая ошибка обработки обращения" },
  { value: "backup_failed", label: "Сбой резервного копирования" },
] as const;
export type NotificationType = (typeof notificationTypes)[number]["value"] | "system";

export const notificationTransports = ["push", "telegram"] as const;
export type NotificationTransport = (typeof notificationTransports)[number];

export type NotificationSettings = {
  /** Типы событий, доставляемые через каждый канал. В центре уведомлений админки — все типы. */
  transports: Record<NotificationTransport, NotificationType[]>;
  /** Не чаще одного уведомления «новое сообщение» по одному диалогу за столько минут. */
  messageThrottleMinutes: number;
};

const ALL_TYPES = notificationTypes.map((t) => t.value) as NotificationType[];

export const defaultNotificationSettings: NotificationSettings = {
  transports: {
    push: ALL_TYPES,
    telegram: ["needs_reply", "request_site", "request_bot", "send_failed", "processing_failed", "backup_failed"],
  },
  messageThrottleMinutes: 15,
};

function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<NotificationSettings>;
  const pick = (list: unknown, fallback: NotificationType[]) =>
    Array.isArray(list) ? (list.filter((t) => ALL_TYPES.includes(t as NotificationType)) as NotificationType[]) : fallback;
  const throttle = Number(value.messageThrottleMinutes);
  return {
    transports: {
      push: pick(value.transports?.push, defaultNotificationSettings.transports.push),
      telegram: pick(value.transports?.telegram, defaultNotificationSettings.transports.telegram),
    },
    messageThrottleMinutes: Number.isFinite(throttle) && throttle >= 1 && throttle <= 1440 ? Math.round(throttle) : 15,
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const rows = await query<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'notifications'");
  return normalizeNotificationSettings(rows[0]?.value);
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const value = normalizeNotificationSettings(settings);
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)],
  );
}

export { normalizeNotificationSettings };
