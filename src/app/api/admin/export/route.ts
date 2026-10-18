import { isAdmin } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { requestsToCsv } from "@/lib/requests/csv";
import { parseFilters } from "@/lib/requests/filters";
import { listRequestsForExport } from "@/lib/requests/repository";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Выгрузка заявок в CSV: все или по текущему фильтру (?q=&status=&sort=). Только для администратора. */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  const url = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(url.searchParams));

  try {
    const rows = await listRequestsForExport(filters);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(requestsToCsv(rows), {
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zayavki-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error("[admin] export failed:", describeDbError(error));
    return Response.json({ error: "Export failed" }, { status: 500, headers: noStore });
  }
}
