import { isAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { isAcceptableWrite, json } from "@/lib/webchat/http";
import { setOperatorTyping } from "@/lib/webchat/service";

export const dynamic = "force-dynamic";

/** Оператор набирает ответ в диалоге веб-чата (сигнал из поля ответа, не чаще раза в несколько секунд). */
export async function POST(request: Request) {
  if (!(await isAdmin())) return json({ error: "unauthorized" }, 401);
  if (!isAcceptableWrite(request)) return json({ error: "forbidden" }, 403);
  let body: { clientId?: unknown; typing?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (typeof body.clientId !== "string") return json({ error: "invalid" }, 400);
  try {
    const ok = await setOperatorTyping(body.clientId, body.typing !== false);
    return json({ ok });
  } catch (error) {
    console.error("[admin] typing signal failed:", describeDbError(error));
    return json({ error: "unavailable" }, 503);
  }
}
