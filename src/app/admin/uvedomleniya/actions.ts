"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";
import { markNotificationsRead, notify } from "@/lib/notifications/service";
import { createTelegramLink, removeRecipient } from "@/lib/notifications/telegram-link";
import { notificationTransports, notificationTypes, saveNotificationSettings, type NotificationType } from "@/lib/ops/settings";
import { ChannelApiError } from "@/lib/chat/errors";
import type { ActionState } from "../actions";

const SESSION_EXPIRED: ActionState = { status: "error", message: "Сессия истекла. Войдите снова." };
const GENERIC_ERROR: ActionState = { status: "error", message: "Не удалось выполнить действие. Попробуйте ещё раз." };

async function authorized(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function markRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("id");
  try {
    const count = id === "all" ? await markNotificationsRead("all") : typeof id === "string" ? await markNotificationsRead([id]) : 0;
    revalidatePath("/admin/uvedomleniya");
    return { status: "success", message: id === "all" ? `Отмечено прочитанными: ${count}.` : "Отмечено прочитанным." };
  } catch (error) {
    console.error("[admin] mark read failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

/** Быстрая отметка из колокольчика (без сообщения в интерфейсе). */
export async function markReadQuiet(id: string): Promise<void> {
  if (!(await authorized())) return;
  await markNotificationsRead(id === "all" ? "all" : [id]).catch(() => 0);
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const allowed = notificationTypes.map((t) => t.value) as string[];
  const transports = Object.fromEntries(
    notificationTransports.map((transport) => [
      transport,
      formData.getAll(`${transport}`).filter((v): v is NotificationType => typeof v === "string" && allowed.includes(v)),
    ]),
  ) as Record<(typeof notificationTransports)[number], NotificationType[]>;
  const throttle = Number(formData.get("throttle"));
  if (!Number.isInteger(throttle) || throttle < 1 || throttle > 1440) return { status: "error", message: "Интервал — целое число минут от 1 до 1440." };
  try {
    await saveNotificationSettings({ transports, messageThrottleMinutes: throttle });
  } catch (error) {
    console.error("[admin] notification settings failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
  revalidatePath("/admin/uvedomleniya/nastroyki");
  return { status: "success", message: "Настройки сохранены." };
}

export type LinkState = ActionState & { url?: string };

export async function createTelegramLinkAction(): Promise<LinkState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  try {
    const { url, expiresInMinutes } = await createTelegramLink();
    return { status: "success", message: `Ссылка действует ${expiresInMinutes} минут и только один раз.`, url };
  } catch (error) {
    const message = error instanceof ChannelApiError ? error.summary : error instanceof Error ? error.message : "ошибка";
    return { status: "error", message: `Не удалось создать ссылку: ${message}` };
  }
}

export async function removeRecipientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  const id = formData.get("id");
  if (typeof id !== "string" || !(await removeRecipient(id).catch(() => false))) return { status: "error", message: "Получатель не найден." };
  revalidatePath("/admin/uvedomleniya/nastroyki");
  return { status: "success", message: "Получатель отключён." };
}

/** Тестовое уведомление: проверить доставку в браузер и Telegram. */
export async function sendTestNotification(): Promise<ActionState> {
  if (!(await authorized())) return SESSION_EXPIRED;
  try {
    await notify({ type: "system", channel: "system", title: "Тестовое уведомление", body: "Проверка доставки", link: "/admin/uvedomleniya/nastroyki", dedupeKey: `test:${Date.now()}` });
    // Тестовое уведомление уходит во все каналы независимо от настроек типов.
    await deliverTestToAll();
    const sent = await deliverPendingNotifications();
    revalidatePath("/admin/uvedomleniya");
    return { status: "success", message: `Тестовое уведомление создано; доставлено сейчас: ${sent}. Результат по каналам — в разделе «Система».` };
  } catch (error) {
    console.error("[admin] test notification failed:", describeDbError(error));
    return GENERIC_ERROR;
  }
}

async function deliverTestToAll(): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(
    `INSERT INTO notification_deliveries (notification_id, transport, target_id)
     SELECT n.id, 'push', s.id FROM notifications n, push_subscriptions s WHERE n.id = (SELECT max(id) FROM notifications WHERE dedupe_key LIKE 'test:%')
     ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO notification_deliveries (notification_id, transport, target_id)
     SELECT n.id, 'telegram', r.id FROM notifications n, notification_recipients r WHERE r.active AND n.id = (SELECT max(id) FROM notifications WHERE dedupe_key LIKE 'test:%')
     ON CONFLICT DO NOTHING`,
  );
}
