import "server-only";
import { query } from "@/lib/db";
import type { ClickEvent, ClickPlacement, MessengerKey } from "./clicks";

export async function recordClick(event: ClickEvent): Promise<void> {
  await query("INSERT INTO messenger_clicks (messenger, placement, page_path) VALUES ($1, $2, $3)", [
    event.messenger,
    event.placement,
    event.path,
  ]);
}

export type ClickStats = {
  total: number;
  byMessenger: Partial<Record<MessengerKey, number>>;
  byPlacement: { placement: ClickPlacement; messenger: MessengerKey; count: number }[];
  topPages: { path: string; count: number }[];
  /** По дням (московское время), новые сверху; не больше 90 дней. */
  byDay: { day: string; messenger: MessengerKey; count: number }[];
};

const TOP_PAGES = 15;
const MAX_DAYS = 90;

/** Сводка за последние `days` дней (null — за всё время). */
export async function getClickStats(days: number | null): Promise<ClickStats> {
  const since = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = "WHERE ($1::timestamptz IS NULL OR created_at >= $1)";
  const params = [since];

  const [byMessenger, byPlacement, topPages, byDay] = await Promise.all([
    query<{ messenger: MessengerKey; count: string }>(
      `SELECT messenger, count(*) AS count FROM messenger_clicks ${where} GROUP BY messenger`,
      params,
    ),
    query<{ placement: ClickPlacement; messenger: MessengerKey; count: string }>(
      `SELECT placement, messenger, count(*) AS count FROM messenger_clicks ${where}
       GROUP BY placement, messenger ORDER BY count(*) DESC`,
      params,
    ),
    query<{ path: string; count: string }>(
      `SELECT page_path AS path, count(*) AS count FROM messenger_clicks ${where}
       GROUP BY page_path ORDER BY count(*) DESC, page_path LIMIT ${TOP_PAGES}`,
      params,
    ),
    query<{ day: string; messenger: MessengerKey; count: string }>(
      `SELECT to_char(created_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS day, messenger, count(*) AS count
       FROM messenger_clicks
       WHERE created_at >= greatest(coalesce($1::timestamptz, '-infinity'), now() - interval '${MAX_DAYS} days')
       GROUP BY day, messenger ORDER BY day DESC`,
      params,
    ),
  ]);

  const counts: Partial<Record<MessengerKey, number>> = {};
  for (const row of byMessenger) counts[row.messenger] = Number(row.count);

  return {
    total: Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0),
    byMessenger: counts,
    byPlacement: byPlacement.map((row) => ({ ...row, count: Number(row.count) })),
    topPages: topPages.map((row) => ({ path: row.path, count: Number(row.count) })),
    byDay: byDay.map((row) => ({ ...row, count: Number(row.count) })),
  };
}
