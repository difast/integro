import { createWebhookHandler, methodNotAllowed } from "@/lib/chat/webhook";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";

export const dynamic = "force-dynamic";

/** Webhook чат-бота MAX: POST https://<домен>/api/max/webhook, секрет — X-Max-Bot-Api-Secret. */
export const POST = createWebhookHandler({
  channel: "max",
  secretHeader: "x-max-bot-api-secret",
  getSecret: () => getMaxConfig().secret,
  isEnabled: () => isMaxEnabled(getMaxConfig()),
});

export const GET = methodNotAllowed;
