import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { isBotUserAgent, parseClickEvent } from "@/lib/stats/clicks";
import { recordClick } from "@/lib/stats/repository";

export const dynamic = "force-dynamic";

/**
 * Учёт переходов по кнопкам мессенджеров (navigator.sendBeacon с сайта).
 * Сохраняются только мессенджер, место кнопки, страница и время — без IP, cookie и User-Agent.
 * Ответ всегда 204: сбой учёта не должен мешать посетителю.
 */

const MAX_BODY = 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

// Ограничение частоты в памяти процесса: адрес нигде не сохраняется и забывается через минуту.
const recent = new Map<string, { count: number; resetAt: number }>();

function tooFrequent(key: string): boolean {
  const now = Date.now();
  if (recent.size > 5_000) {
    for (const [k, v] of recent) if (v.resetAt <= now) recent.delete(k);
  }
  const entry = recent.get(key);
  if (!entry || entry.resetAt <= now) {
    recent.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isDatabaseConfigured() || !sameOrigin(request) || isBotUserAgent(request.headers.get("user-agent"))) {
    return done();
  }

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (tooFrequent(client)) return done();

  let event;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return done();
    event = parseClickEvent(JSON.parse(text));
  } catch {
    return done();
  }
  if (!event) return done();

  try {
    await recordClick(event);
  } catch (error) {
    console.error("[clicks] failed to record:", describeDbError(error));
  }
  return done();
}
