import "server-only";
import { runScheduledBackup } from "@/lib/backup/run";
import { sweepChats } from "@/lib/chat/processor";
import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";
import { runHealthChecks } from "./health";
import { runRetention } from "./retention";

/**
 * Фоновый цикл сервера (раз в минуту, запускается из src/instrumentation.ts): досылка сообщений ботов,
 * доставка уведомлений, автоматические сообщения, ежедневная резервная копия, сроки хранения и проверка
 * интеграций раз в 30 минут. Каждая задача защищена от параллельного запуска и не роняет остальные.
 */

let lastHealth = 0;
let lastRetention = 0;
let ticking = false;

export async function maintenanceTick(now = Date.now()): Promise<void> {
  if (ticking || !isDatabaseConfigured()) return;
  ticking = true;
  try {
    const tasks: [string, () => Promise<unknown>][] = [
      ["chats", () => sweepChats()],
      ["notifications", () => deliverPendingNotifications()],
      ["backup", () => runScheduledBackup(new Date(now))],
    ];
    if (now - lastHealth > 30 * 60_000) {
      lastHealth = now;
      tasks.push(["health", () => runHealthChecks()]);
    }
    if (now - lastRetention > 24 * 60 * 60_000) {
      lastRetention = now;
      tasks.push(["retention", () => runRetention()]);
    }
    for (const [name, task] of tasks) {
      try {
        await task();
      } catch (error) {
        console.error(`[scheduler] ${name} failed:`, describeDbError(error));
      }
    }
  } finally {
    ticking = false;
  }
}
