import { getClientIp } from "@/lib/client-ip";
import { describeDbError } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { json, readSessionToken } from "@/lib/webchat/http";
import { findSession, getVisitorUpdates } from "@/lib/webchat/service";

export const dynamic = "force-dynamic";

const ID_RE = /^\d{1,18}$/;

/**
 * Обновления виджета онлайн-чата. Диалог определяется только по cookie сессии; без неё — { dialog: false }.
 * ?after=<id>&since=<время> — новые сообщения; ?before=<id> — более ранние; без параметров — последние.
 */
export async function GET(request: Request) {
  // Открытый виджет опрашивает сервер раз в несколько секунд; лимит отсекает только злоупотребления.
  if (isRateLimited(`webchat:poll:${await getClientIp()}`, 2000)) return json({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;
  try {
    const session = await findSession(await readSessionToken());
    if (!session) return json({ dialog: false });
    const updates = await getVisitorUpdates(session, {
      after: after && ID_RE.test(after) ? after : null,
      before: before && ID_RE.test(before) ? before : null,
      since,
    });
    return json({ dialog: true, ...updates });
  } catch (error) {
    console.error("[webchat] updates failed:", describeDbError(error));
    return json({ error: "unavailable" }, 503);
  }
}
