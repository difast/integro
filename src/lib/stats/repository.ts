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

export type MessengerClickSummary = {
  today: number;
  last7: number;
  last30: number;
  total: number;
  lastClickAt: Date | null;
  /** За 30 дней. */
  byPlacement: { placement: ClickPlacement; count: number }[];
  /** За 30 дней, 10 страниц с наибольшим числом нажатий. */
  topPages: { path: string; count: number }[];
};

/** Сводка нажатий на кнопку одного мессенджера (например, WhatsApp — у него нет бота и переписки на сайте). */
export async function getMessengerClickSummary(messenger: MessengerKey): Promise<MessengerClickSummary> {
  const [totals, byPlacement, topPages] = await Promise.all([
    query<{ today: string; last7: string; last30: string; total: string; last_click_at: Date | null }>(
      `SELECT
         count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') AS today,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last7,
         count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last30,
         count(*) AS total,
         max(created_at) AS last_click_at
       FROM messenger_clicks WHERE messenger = $1`,
      [messenger],
    ),
    query<{ placement: ClickPlacement; count: string }>(
      `SELECT placement, count(*) AS count FROM messenger_clicks
       WHERE messenger = $1 AND created_at >= now() - interval '30 days'
       GROUP BY placement ORDER BY count(*) DESC`,
      [messenger],
    ),
    query<{ path: string; count: string }>(
      `SELECT page_path AS path, count(*) AS count FROM messenger_clicks
       WHERE messenger = $1 AND created_at >= now() - interval '30 days'
       GROUP BY page_path ORDER BY count(*) DESC, page_path LIMIT 10`,
      [messenger],
    ),
  ]);
  const row = totals[0];
  return {
    today: Number(row?.today ?? 0),
    last7: Number(row?.last7 ?? 0),
    last30: Number(row?.last30 ?? 0),
    total: Number(row?.total ?? 0),
    lastClickAt: row?.last_click_at ?? null,
    byPlacement: byPlacement.map((r) => ({ placement: r.placement, count: Number(r.count) })),
    topPages: topPages.map((r) => ({ path: r.path, count: Number(r.count) })),
  };
}
