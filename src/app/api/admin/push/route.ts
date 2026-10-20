import { isAdmin } from "@/lib/admin/auth";
import { isSameOrigin, noStore } from "@/lib/admin/origin";
import { describeDbError, query } from "@/lib/db";
import { getPushConfig } from "@/lib/notifications/config";

export const dynamic = "force-dynamic";

/**
 * Подписка браузера на push-уведомления (Web Push). Сохраняются только endpoint и ключи шифрования,
 * которые браузер выдаёт для этой подписки. Только после входа и только с этого же сайта.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  if (!getPushConfig()) return Response.json({ error: "Push is not configured" }, { status: 503, headers: noStore });

  let body: { action?: unknown; subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; label?: unknown };
  try {
    const text = await request.text();
    if (text.length > 5000) return Response.json({ error: "Too large" }, { status: 413, headers: noStore });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStore });
  }

  const endpoint = body.subscription?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !/^https:\/\//.test(endpoint)) {
    return Response.json({ error: "Invalid subscription" }, { status: 400, headers: noStore });
  }

  try {
    if (body.action === "unsubscribe") {
      await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
      return Response.json({ ok: true }, { headers: noStore });
    }
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;
    if (typeof p256dh !== "string" || typeof auth !== "string" || !/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{10,100}$/.test(auth)) {
      return Response.json({ error: "Invalid subscription" }, { status: 400, headers: noStore });
    }
    const label = typeof body.label === "string" ? body.label.replace(/[^\p{L}\p{N} .,()/-]/gu, "").slice(0, 100) : "";
    await query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, label) VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, label = EXCLUDED.label, failures = 0`,
      [endpoint, p256dh, auth, label],
    );
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("[admin] push subscription failed:", describeDbError(error));
    return Response.json({ error: "Unavailable" }, { status: 503, headers: noStore });
  }
}
