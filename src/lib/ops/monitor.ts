import "server-only";
import { describeDbError, query } from "@/lib/db";

/**
 * Журнал операций интеграций (system_events) и сводка «последний успех / последняя ошибка»
 * (integration_status). Пишется только безопасное описание: без токенов, заголовков и персональных
 * данных. Сбой записи журнала никогда не прерывает основную операцию.
 */

export type MonitorChannel = "max" | "telegram" | "web" | "site" | "push" | "telegram_admin" | "backup" | "system";
export type MonitorResult = "ok" | "error" | "retry" | "duplicate" | "failed";

export const monitorChannelLabels: Record<MonitorChannel, string> = {
  max: "MAX",
  telegram: "Telegram",
  web: "Веб-чат",
  site: "Сайт",
  push: "Push-уведомления",
  telegram_admin: "Уведомления в Telegram",
  backup: "Резервное копирование",
  system: "Система",
};

export const monitorOperationLabels: Record<string, string> = {
  webhook: "Приём Webhook",
  process_event: "Обработка события",
  send_message: "Отправка сообщения клиенту",
  visitor_message: "Сообщение посетителя веб-чата",
  create_request: "Создание заявки",
  notify: "Доставка уведомления",
  backup: "Резервная копия",
  retention: "Удаление по сроку хранения",
  check: "Проверка подключения",
};

/** Очистка текста ошибки: без строк, похожих на токены, и не длиннее 500 символов. */
export function safeMessage(text: string): string {
  return text
    .replace(/bot\d+:[\w-]+/g, "bot***")
    .replace(/\b\d{6,}:[\w-]{20,}\b/g, "***")
    .replace(/(authorization|token|secret|password)\s*[:=]\s*\S+/gi, "$1=***")
    .slice(0, 500);
}

export async function recordEvent(
  channel: MonitorChannel,
  operation: string,
  result: MonitorResult,
  details: { ref?: string | null; message?: string } = {},
): Promise<void> {
  try {
    await query("INSERT INTO system_events (channel, operation, result, ref, message) VALUES ($1, $2, $3, $4, $5)", [
      channel,
      operation.slice(0, 40),
      result,
      details.ref ? details.ref.slice(0, 200) : null,
      safeMessage(details.message ?? ""),
    ]);
  } catch (error) {
    console.error("[monitor] failed to record event:", describeDbError(error));
  }
}

/** Отметка успешной операции: только время, без записи в журнал (иначе журнал разрастается). */
export async function markOk(channel: MonitorChannel, operation: string, details?: Record<string, unknown>): Promise<void> {
  try {
    await query(
      `INSERT INTO integration_status (key, last_ok_at, details, updated_at) VALUES ($1, now(), $2, now())
       ON CONFLICT (key) DO UPDATE SET last_ok_at = now(), details = coalesce(EXCLUDED.details, integration_status.details), updated_at = now()`,
      [`${channel}:${operation}`, details ? JSON.stringify(details) : null],
    );
  } catch (error) {
    console.error("[monitor] failed to mark status:", describeDbError(error));
  }
}

/** Ошибка: запись в журнал и в сводку статуса. */
export async function markError(
  channel: MonitorChannel,
  operation: string,
  message: string,
  details: { ref?: string | null; result?: MonitorResult } = {},
): Promise<void> {
  const text = safeMessage(message);
  await recordEvent(channel, operation, details.result ?? "error", { ref: details.ref, message: text });
  try {
    await query(
      `INSERT INTO integration_status (key, last_error_at, last_error, updated_at) VALUES ($1, now(), $2, now())
       ON CONFLICT (key) DO UPDATE SET last_error_at = now(), last_error = EXCLUDED.last_error, updated_at = now()`,
      [`${channel}:${operation}`, text],
    );
  } catch (error) {
    console.error("[monitor] failed to mark status:", describeDbError(error));
  }
}
