import "server-only";
import webpush from "web-push";
import { ChannelApiError } from "@/lib/chat/errors";
import { describeDbError, query } from "@/lib/db";
import { markError, markOk } from "@/lib/ops/monitor";
import type { NotificationType } from "@/lib/ops/settings";
import { absoluteUrl } from "@/lib/site";
import { telegramApi } from "@/lib/telegram/api";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";
import { getPushConfig } from "./config";
import { externalText } from "./texts";

/**
 * Очередь доставки уведомлений (notification_deliveries). Каждая строка захватывается атомарно.
 * Повтор — только когда отправка точно не состоялась (нет соединения, лимит запросов, временная ошибка
 * сервиса push), с растущим интервалом; после MAX_ATTEMPTS — статус failed и запись в журнал.
 */

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];

type Claimed = {
  id: string;
  transport: "push" | "telegram";
  target_id: string;
  attempts: number;
  type: NotificationType;
  channel: string;
  link: string | null;
  notification_id: string;
};

class Retryable extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}
class Gone extends Error {}

let configuredVapid: string | null = null;

async function sendPush(row: Claimed): Promise<void> {
  const config = getPushConfig();
  if (!config) throw new Error("Push не настроен (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
  if (configuredVapid !== config.publicKey) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredVapid = config.publicKey;
  }
  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE id = $1", [row.target_id]);
  const sub = subs[0];
  if (!sub) throw new Gone("Подписка удалена.");
  const text = externalText(row.type, row.channel);
  const payload = JSON.stringify({ ...text, url: row.link ?? "/admin/uvedomleniya", tag: `n${row.notification_id}` });
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600, urgency: "high", timeout: 10_000 });
    await query("UPDATE push_subscriptions SET last_success_at = now(), failures = 0 WHERE id = $1", [row.target_id]);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Подписка истекла или отозвана браузером — удаляем.
      await query("DELETE FROM push_subscriptions WHERE id = $1", [row.target_id]);
      throw new Gone(`Подписка недействительна (${status}) и удалена.`);
    }
    await query("UPDATE push_subscriptions SET failures = failures + 1 WHERE id = $1", [row.target_id]);
    if (status === 429 || (status !== undefined && status >= 500) || status === undefined) {
      const retryAfter = Number((error as { headers?: Record<string, string> }).headers?.["retry-after"]);
      throw new Retryable(`Сервис push: ${status ?? "нет соединения"}`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
    }
    throw new Error(`Сервис push отклонил уведомление (${status}).`);
  }
}

async function sendTelegram(row: Claimed): Promise<void> {
  if (!isTelegramEnabled(getTelegramConfig())) throw new Error("Telegram-бот не настроен.");
  const recipients = await query<{ chat_id: string; active: boolean }>("SELECT chat_id, active FROM notification_recipients WHERE id = $1", [row.target_id]);
  const recipient = recipients[0];
  if (!recipient?.active) throw new Gone("Получатель отключён.");
  const text = externalText(row.type, row.channel);
  const link = row.link ? absoluteUrl(row.link) : null;
  try {
    await telegramApi.sendMessage(Number(recipient.chat_id), [text.title, text.body, link].filter(Boolean).join("\n"));
  } catch (error) {
    if (error instanceof ChannelApiError) {
      if (error.blocked) {
        await query("UPDATE notification_recipients SET active = false WHERE id = $1", [row.target_id]);
        throw new Gone("Получатель заблокировал бота — уведомления в Telegram для него отключены.");
      }
      if (error.retryable) throw new Retryable(error.summary, error.retryAfterMs);
      // unknown — сообщение могло дойти: не повторяем, чтобы не дублировать.
      throw new Error(error.summary);
    }
    throw error;
  }
}

let running = false;

/** Отправляет ожидающие уведомления. Безопасно вызывать параллельно и повторно. */
export async function deliverPendingNotifications(limit = 50): Promise<number> {
  if (running) return 0;
  running = true;
  let done = 0;
  try {
    await query(
      `UPDATE notification_deliveries SET status = 'pending', next_attempt_at = now()
       WHERE status = 'sending' AND claimed_at < now() - interval '5 minutes'`,
    );
    const rows = await query<Claimed>(
      `WITH next AS (
         SELECT id FROM notification_deliveries
         WHERE status = 'pending' AND next_attempt_at <= now()
         ORDER BY id LIMIT ${limit} FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_deliveries d SET status = 'sending', attempts = d.attempts + 1, claimed_at = now()
       FROM next, notifications n
       WHERE d.id = next.id AND n.id = d.notification_id
       RETURNING d.id, d.transport, d.target_id, d.attempts, n.type, n.channel, n.link, n.id AS notification_id`,
    );
    for (const row of rows) {
      const operation = "notify";
      const monitorChannel = row.transport === "push" ? "push" : "telegram_admin";
      try {
        if (row.transport === "push") await sendPush(row);
        else await sendTelegram(row);
        await query("UPDATE notification_deliveries SET status = 'sent', sent_at = now(), error = NULL WHERE id = $1", [row.id]);
        await markOk(monitorChannel, operation);
        done += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (error instanceof Gone) {
          await query("UPDATE notification_deliveries SET status = 'skipped', error = $2 WHERE id = $1", [row.id, message.slice(0, 300)]);
          continue;
        }
        if (error instanceof Retryable && row.attempts < MAX_ATTEMPTS) {
          const delayMs = Math.max(error.retryAfterMs ?? 0, BACKOFF_MINUTES[row.attempts - 1]! * 60_000);
          await query(
            "UPDATE notification_deliveries SET status = 'pending', error = $2, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1",
            [row.id, message.slice(0, 300), Math.ceil(delayMs / 1000)],
          );
          await markError(monitorChannel, operation, message, { ref: `delivery:${row.id}`, result: "retry" });
          continue;
        }
        await query("UPDATE notification_deliveries SET status = 'failed', error = $2 WHERE id = $1", [row.id, message.slice(0, 300)]);
        await markError(monitorChannel, operation, message, { ref: `delivery:${row.id}`, result: "failed" });
      }
    }
  } catch (error) {
    console.error("[notify] delivery failed:", describeDbError(error));
  } finally {
    running = false;
  }
  return done;
}

/** Повтор неуспешной доставки из раздела «Система». */
export async function retryDelivery(id: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(id)) return false;
  const rows = await query<{ id: string }>(
    "UPDATE notification_deliveries SET status = 'pending', attempts = 0, next_attempt_at = now(), error = NULL WHERE id = $1 AND status = 'failed' RETURNING id",
    [id],
  );
  if (rows.length) await deliverPendingNotifications();
  return rows.length > 0;
}
