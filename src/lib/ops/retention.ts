import "server-only";
import { query } from "@/lib/db";
import { markError, markOk, recordEvent } from "./monitor";

/**
 * Сроки хранения. Служебные записи очищаются всегда; персональные данные (переписка, заявки) —
 * только если владелец задал срок в разделе «Система» (по умолчанию выключено: решение за оператором ПДн).
 */

export type RetentionSettings = {
  /** Удалять карточки закрытых диалогов (с перепиской), неактивные дольше N дней. null — не удалять. */
  chatDays: number | null;
  /** Удалять завершённые и отклонённые заявки, не изменявшиеся дольше N дней. null — не удалять. */
  requestDays: number | null;
};

const SERVICE_RETENTION = {
  notificationsDays: 90, // в уведомлениях могут быть имена клиентов
  systemEventsDays: 180,
  backupRunsDays: 365,
};

function normalize(raw: unknown): RetentionSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const days = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 30 && v <= 3650 ? v : null);
  return { chatDays: days(value.chatDays), requestDays: days(value.requestDays) };
}

export async function getRetentionSettings(): Promise<RetentionSettings> {
  const rows = await query<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'retention'");
  return normalize(rows[0]?.value);
}

export async function saveRetentionSettings(settings: RetentionSettings): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('retention', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(normalize(settings))],
  );
}

export async function runRetention(): Promise<{ chats: number; requests: number }> {
  try {
    await query(`DELETE FROM notifications WHERE created_at < now() - make_interval(days => $1)`, [SERVICE_RETENTION.notificationsDays]);
    await query(`DELETE FROM system_events WHERE created_at < now() - make_interval(days => $1)`, [SERVICE_RETENTION.systemEventsDays]);
    await query(`DELETE FROM backup_runs WHERE started_at < now() - make_interval(days => $1)`, [SERVICE_RETENTION.backupRunsDays]);
    await query("DELETE FROM admin_link_codes WHERE expires_at < now() - interval '1 day'");

    const settings = await getRetentionSettings();
    let chats = 0;
    let requests = 0;
    if (settings.chatDays) {
      const rows = await query<{ id: string }>(
        "DELETE FROM chat_clients WHERE status = 'closed' AND last_seen_at < now() - make_interval(days => $1) RETURNING id",
        [settings.chatDays],
      );
      chats = rows.length;
    }
    if (settings.requestDays) {
      const rows = await query<{ id: string }>(
        "DELETE FROM requests WHERE status IN ('done', 'rejected') AND updated_at < now() - make_interval(days => $1) RETURNING id",
        [settings.requestDays],
      );
      requests = rows.length;
    }
    if (chats || requests) await recordEvent("system", "retention", "ok", { message: `Удалено по сроку хранения: диалогов ${chats}, заявок ${requests}` });
    await markOk("system", "retention");
    return { chats, requests };
  } catch (error) {
    await markError("system", "retention", error instanceof Error ? error.message : "ошибка");
    return { chats: 0, requests: 0 };
  }
}
