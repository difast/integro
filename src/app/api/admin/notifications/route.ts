import { isAdmin } from "@/lib/admin/auth";
import { noStore } from "@/lib/admin/origin";
import { describeDbError } from "@/lib/db";
import { notificationSummary } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/** Счётчик непрочитанных и последние уведомления — для индикатора в шапке админки. Только после входа. */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  try {
    const summary = await notificationSummary();
    return Response.json(
      {
        unread: summary.unread,
        lastId: summary.lastId,
        latest: summary.latest.map((n) => ({ id: n.id, type: n.type, channel: n.channel, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt, read: Boolean(n.readAt) })),
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("[admin] notifications summary failed:", describeDbError(error));
    return Response.json({ error: "Unavailable" }, { status: 503, headers: noStore });
  }
}
