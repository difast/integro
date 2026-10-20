import { isAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { analyticsRequestsToCsv, reportToCsv } from "@/lib/analytics/csv";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { getAnalyticsReport, listAnalyticsRequests } from "@/lib/analytics/repository";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Выгрузка аналитики: показатели (по умолчанию) или заявки с полями воронки (?kind=requests) — без ПДн. */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }
  const url = new URL(request.url);
  const filters = parseAnalyticsFilters(Object.fromEntries(url.searchParams));
  const kind = url.searchParams.get("kind") === "requests" ? "requests" : "summary";
  try {
    const body =
      kind === "requests" ? analyticsRequestsToCsv(await listAnalyticsRequests(filters)) : reportToCsv(await getAnalyticsReport(filters), filters);
    const name = kind === "requests" ? "analitika-zayavki" : "analitika";
    return new Response(body, {
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${filters.from}-${filters.to}.csv"`,
      },
    });
  } catch (error) {
    console.error("[admin] analytics export failed:", describeDbError(error));
    return Response.json({ error: "Export failed" }, { status: 500, headers: noStore });
  }
}
