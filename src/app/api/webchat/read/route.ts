import { describeDbError } from "@/lib/db";
import { isAcceptableWrite, json, readSessionToken } from "@/lib/webchat/http";
import { findSession, markVisitorRead } from "@/lib/webchat/service";

export const dynamic = "force-dynamic";

/** Посетитель видит ответы консультанта (чат открыт) — отметка «прочитано» для админки. */
export async function POST(request: Request) {
  if (!isAcceptableWrite(request)) return json({ error: "forbidden" }, 403);
  try {
    const session = await findSession(await readSessionToken());
    if (!session) return json({ ok: false });
    await markVisitorRead(session);
    return json({ ok: true });
  } catch (error) {
    console.error("[webchat] read mark failed:", describeDbError(error));
    return json({ error: "unavailable" }, 503);
  }
}
