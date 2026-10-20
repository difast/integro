import "server-only";
import { after } from "next/server";
import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { processEvent, storeEvent, sweepChats } from "./processor";
import { isWebhookSecretValid } from "./secret";
import type { Channel } from "./types";

/**
 * Общий обработчик Webhook мессенджера.
 * - Подлинность — секрет в заголовке платформы, сравнение за постоянное время; без секрета события
 *   не принимаются вовсе.
 * - Событие сохраняется в базу (повторная доставка не создаёт дубль), платформа сразу получает 200;
 *   сценарий и ответы выполняются после ответа.
 * - База недоступна — 503, чтобы платформа доставила событие повторно.
 * - Содержимое событий в журнал не пишется.
 */

const MAX_BODY_BYTES = 256 * 1024;
const FAILED_AUTH_LIMIT = 30;
const failedAuth = new Map<string, { count: number; resetAt: number }>();

function tooManyFailures(key: string): boolean {
  const entry = failedAuth.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= FAILED_AUTH_LIMIT);
}

function recordFailure(key: string) {
  const now = Date.now();
  if (failedAuth.size > 5_000) for (const [k, v] of failedAuth) if (v.resetAt <= now) failedAuth.delete(k);
  const entry = failedAuth.get(key);
  if (!entry || entry.resetAt <= now) failedAuth.set(key, { count: 1, resetAt: now + 10 * 60_000 });
  else entry.count += 1;
}

const reply = (status: number, text: string) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export function createWebhookHandler(options: {
  channel: Channel;
  secretHeader: string;
  getSecret: () => string | null;
  isEnabled: () => boolean;
}) {
  return async function POST(request: Request): Promise<Response> {
    if (!options.isEnabled() || !isDatabaseConfigured()) return reply(503, "Integration is not configured");

    const ip = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limiterKey = `${options.channel}:${ip}`;
    if (tooManyFailures(limiterKey)) return reply(429, "Too many requests");

    if (!isWebhookSecretValid(request.headers.get(options.secretHeader), options.getSecret())) {
      recordFailure(limiterKey);
      console.warn(`[${options.channel}] webhook request with an invalid secret rejected`);
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
      stored = await storeEvent(options.channel, raw);
    } catch (error) {
      console.error(`[${options.channel}] failed to store webhook event:`, describeDbError(error));
      return reply(503, "Temporarily unavailable");
    }
    if (!stored) return reply(400, "Unsupported update");

    if (!stored.duplicate) {
      const id = stored.id;
      after(async () => {
        try {
          await processEvent(id);
        } catch (error) {
          console.error(`[${options.channel}] event processing crashed:`, describeDbError(error));
        }
        await sweepChats();
      });
    } else {
      // Повторная доставка: событие не дублируется; если первая обработка не завершилась, её доделает проверка.
      after(() => sweepChats());
    }
    return reply(200, "OK");
  };
}

export function methodNotAllowed(): Response {
  return reply(405, "Method Not Allowed");
}
