import { after } from "next/server";
import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import { processEvent, storeEvent, sweepMax } from "@/lib/max/processor";
import { isWebhookSecretValid } from "@/lib/max/secret";

export const dynamic = "force-dynamic";

/**
 * Webhook чат-бота MAX: POST https://<домен>/api/max/webhook.
 *
 * - Подлинность — заголовок X-Max-Bot-Api-Secret (секрет из MAX_WEBHOOK_SECRET, задаётся при подписке).
 * - Событие сохраняется в базу (повторная доставка того же события не создаёт дубль),
 *   после чего MAX сразу получает 200; сценарий и ответы выполняются после ответа.
 * - Если база недоступна — 503, чтобы MAX мог доставить событие повторно.
 * - Содержимое событий в журнал не пишется.
 */

const MAX_BODY_BYTES = 256 * 1024;
const FAILED_AUTH_LIMIT = 30;
const failedAuth = new Map<string, { count: number; resetAt: number }>();

function tooManyFailures(ip: string): boolean {
  const entry = failedAuth.get(ip);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= FAILED_AUTH_LIMIT);
}

function recordFailure(ip: string) {
  const now = Date.now();
  if (failedAuth.size > 5_000) for (const [key, value] of failedAuth) if (value.resetAt <= now) failedAuth.delete(key);
  const entry = failedAuth.get(ip);
  if (!entry || entry.resetAt <= now) failedAuth.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
  else entry.count += 1;
}

const reply = (status: number, text: string) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const config = getMaxConfig();
  if (!isMaxEnabled(config) || !isDatabaseConfigured()) {
    // Без секрета события не принимаются: проверить их подлинность невозможно.
    return reply(503, "MAX integration is not configured");
  }

  const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyFailures(ip)) return reply(429, "Too many requests");

  if (!isWebhookSecretValid(request.headers.get("x-max-bot-api-secret"), config.secret)) {
    recordFailure(ip);
    console.warn("[max] webhook request with an invalid secret rejected");
    return reply(401, "Unauthorized");
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return reply(413, "Payload too large");

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, "Payload too large");
    raw = JSON.parse(text);
  } catch {
    return reply(400, "Invalid JSON");
  }

  let stored: Awaited<ReturnType<typeof storeEvent>>;
  try {
    stored = await storeEvent(raw);
  } catch (error) {
    console.error("[max] failed to store webhook event:", describeDbError(error));
    return reply(503, "Temporarily unavailable");
  }
  if (!stored) return reply(400, "Unsupported update");

  if (!stored.duplicate) {
    const id = stored.id;
    after(async () => {
      try {
        await processEvent(id);
      } catch (error) {
        console.error("[max] event processing crashed:", describeDbError(error));
      }
      await sweepMax();
    });
  } else {
    // Повторная доставка: событие не дублируется; если первая обработка не завершилась, её доделает проверка.
    after(() => sweepMax());
  }
  return reply(200, "OK");
}

export function GET() {
  return reply(405, "Method Not Allowed");
}
