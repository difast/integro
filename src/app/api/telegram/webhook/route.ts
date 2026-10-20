import { createWebhookHandler, methodNotAllowed } from "@/lib/chat/webhook";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";

export const dynamic = "force-dynamic";

/** Webhook Telegram-бота: POST https://<домен>/api/telegram/webhook, секрет — X-Telegram-Bot-Api-Secret-Token. */
export const POST = createWebhookHandler({
  channel: "telegram",
  secretHeader: "x-telegram-bot-api-secret-token",
  getSecret: () => getTelegramConfig().secret,
  isEnabled: () => isTelegramEnabled(getTelegramConfig()),
});

export const GET = methodNotAllowed;
