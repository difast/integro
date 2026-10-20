import "server-only";
import { ChannelApiError } from "@/lib/chat/errors";
import { query } from "@/lib/db";
import { maxApi } from "@/lib/max/api";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import { telegramApi } from "@/lib/telegram/api";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";
import { markError, markOk } from "./monitor";

/**
 * Проверка подключения к API мессенджеров. Выполняется в фоне не чаще раза в 30 минут (и по кнопке
 * в разделе «Система»); результат сохраняется — открытие админки к внешним API не обращается.
 */

const describe = (error: unknown) => (error instanceof ChannelApiError ? error.summary : error instanceof Error ? error.message : "ошибка");

export async function checkTelegramHealth(): Promise<void> {
  const config = getTelegramConfig();
  if (!isTelegramEnabled(config)) return;
  try {
    const info = await telegramApi.getWebhookInfo();
    const ownUrl = Boolean(info.url && info.url === config.webhookUrl);
    const details = {
      webhookSet: Boolean(info.url),
      ownUrl,
      pending: info.pending_update_count,
      lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
      lastError: info.last_error_message ?? null,
    };
    if (!ownUrl) await markError("telegram", "check", info.url ? "Webhook Telegram указывает не на этот сайт." : "Webhook Telegram не зарегистрирован.");
    else await markOk("telegram", "check", details);
    await query("UPDATE integration_status SET details = $2 WHERE key = $1", ["telegram:check", JSON.stringify(details)]);
  } catch (error) {
    await markError("telegram", "check", describe(error));
  }
}

export async function checkMaxHealth(): Promise<void> {
  const config = getMaxConfig();
  if (!isMaxEnabled(config)) return;
  try {
    const subs = await maxApi.getSubscriptions();
    const list = subs.subscriptions ?? [];
    const ownUrl = list.some((s) => s.url === config.webhookUrl);
    const details = { subscriptions: list.length, ownUrl };
    if (!ownUrl) await markError("max", "check", "Подписка MAX на Webhook этого сайта не найдена.");
    else await markOk("max", "check", details);
    await query("UPDATE integration_status SET details = $2 WHERE key = $1", ["max:check", JSON.stringify(details)]);
  } catch (error) {
    await markError("max", "check", describe(error));
  }
}

export async function runHealthChecks(): Promise<void> {
  await Promise.all([checkTelegramHealth(), checkMaxHealth()]);
}
