import { company } from "@/config/company";
import { getClientIp } from "@/lib/client-ip";
import { describeDbError } from "@/lib/db";
import { markError, markOk } from "@/lib/ops/monitor";
import { isRateLimited } from "@/lib/rate-limit";
import { isAcceptableWrite, json, readSessionToken, writeSessionToken } from "@/lib/webchat/http";
import { postVisitorMessage, WEBCHAT_MESSAGE_MAX } from "@/lib/webchat/service";

export const dynamic = "force-dynamic";

/** Сообщение посетителя онлайн-чата. Ответ 200 — только после сохранения в базе. */
export async function POST(request: Request) {
  if (!isAcceptableWrite(request)) return json({ error: "forbidden" }, 403);
  let body: { text?: unknown; key?: unknown; consent?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim() : "";
  if (!text) return json({ error: "empty" }, 400);
  if (text.length > WEBCHAT_MESSAGE_MAX) return json({ error: "too_long", max: WEBCHAT_MESSAGE_MAX }, 400);
  if (typeof body.key !== "string") return json({ error: "invalid" }, 400);
  const source = typeof body.source === "string" && /^\/[\w\-./]{0,150}$/.test(body.source) ? body.source : null;

  const ip = await getClientIp();
  const token = await readSessionToken();
  // Лимиты (в памяти процесса, окно 14 минут): сообщения с одного адреса и новые диалоги с одного адреса.
  if (isRateLimited(`webchat:msg:${ip}`, 60)) return json({ error: "rate_limited" }, 429, { "Retry-After": "120" });
  if (!token && isRateLimited(`webchat:new:${ip}`, 5)) return json({ error: "rate_limited" }, 429, { "Retry-After": "300" });

  try {
    const result = await postVisitorMessage({
      token,
      text,
      key: body.key,
      consent: body.consent === true,
      consentRevision: company.legalRevisionDate,
      source,
    });
    if (!result.ok) return json({ error: result.reason }, result.reason === "consent" ? 400 : 409);
    if (result.token) await writeSessionToken(result.token);
    await markOk("web", "visitor_message");
    return json({ message: result.message, duplicate: result.duplicate });
  } catch (error) {
    const text = describeDbError(error);
    console.error("[webchat] message failed:", text);
    await markError("web", "visitor_message", text);
    return json({ error: "unavailable" }, 503);
  }
}
