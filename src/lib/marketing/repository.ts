import "server-only";
import { query } from "@/lib/db";
import type { MarketingLinkInput } from "./links";

export type MarketingLink = MarketingLinkInput & { id: number; active: boolean; createdAt: Date };

type LinkRow = {
  id: number;
  slug: string;
  title: string;
  owner_label: string;
  target_path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  active: boolean;
  created_at: Date;
};

const COLUMNS = "id, slug, title, owner_label, target_path, utm_source, utm_medium, utm_campaign, active, created_at";

const toLink = (r: LinkRow): MarketingLink => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  ownerLabel: r.owner_label,
  targetPath: r.target_path,
  utmSource: r.utm_source,
  utmMedium: r.utm_medium,
  utmCampaign: r.utm_campaign,
  active: r.active,
  createdAt: r.created_at,
});

export async function getActiveLinkBySlug(slug: string): Promise<MarketingLink | null> {
  const rows = await query<LinkRow>(`SELECT ${COLUMNS} FROM marketing_links WHERE slug = $1 AND active`, [slug]);
  return rows[0] ? toLink(rows[0]) : null;
}

/** Переход по ссылке: сохраняются только ссылка и время — без IP, браузера и других данных о посетителе. */
export async function recordLinkClick(linkId: number): Promise<void> {
  await query("INSERT INTO marketing_link_clicks (link_id) VALUES ($1)", [linkId]);
}

export async function createMarketingLink(link: MarketingLinkInput): Promise<"created" | "duplicate"> {
  const rows = await query<{ id: number }>(
    `INSERT INTO marketing_links (slug, title, owner_label, target_path, utm_source, utm_medium, utm_campaign)
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [link.slug, link.title, link.ownerLabel, link.targetPath, link.utmSource, link.utmMedium, link.utmCampaign],
  );
  return rows[0] ? "created" : "duplicate";
}

export async function setMarketingLinkActive(id: number, active: boolean): Promise<boolean> {
  const rows = await query<{ id: number }>("UPDATE marketing_links SET active = $2 WHERE id = $1 RETURNING id", [id, active]);
  return rows.length > 0;
}

export type LinkStats = MarketingLink & {
  clicks: number;
  /** Заявки с сайта, пришедшие после перехода по ссылке (по UTM-меткам заявки). */
  requests: number;
  /** Из них — выигранные сделки. */
  won: number;
  /** Сумма оплат по этим заявкам, ₽. */
  paid: number;
  lastClickAt: Date | null;
};

/**
 * Сводка по всем ссылкам за последние `days` дней (null — за всё время). Заявка относится к ссылке,
 * если её UTM-метки совпадают: utm_content = короткое имя и utm_source = площадка ссылки.
 */
export async function listLinkStats(days: number | null): Promise<LinkStats[]> {
  const since = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await query<LinkRow & { clicks: string; requests: string; won: string; paid: string; last_click_at: Date | null }>(
    `SELECT ${COLUMNS.split(", ").map((c) => `l.${c}`).join(", ")},
       (SELECT count(*) FROM marketing_link_clicks c WHERE c.link_id = l.id AND ($1::timestamptz IS NULL OR c.created_at >= $1)) AS clicks,
       (SELECT max(c.created_at) FROM marketing_link_clicks c WHERE c.link_id = l.id) AS last_click_at,
       r.requests, r.won, r.paid
     FROM marketing_links l
     CROSS JOIN LATERAL (
       SELECT count(*) AS requests,
              count(*) FILTER (WHERE stage = 'won') AS won,
              coalesce(sum(paid_amount) FILTER (WHERE payment_status <> 'none'), 0) AS paid
       FROM requests
       WHERE attribution->>'utm_content' = l.slug AND attribution->>'utm_source' = l.utm_source
         AND ($1::timestamptz IS NULL OR created_at >= $1)
     ) r
     ORDER BY l.active DESC, l.created_at, l.id`,
    [since],
  );
  return rows.map((r) => ({
    ...toLink(r),
    clicks: Number(r.clicks),
    requests: Number(r.requests),
    won: Number(r.won),
    paid: Number(r.paid),
    lastClickAt: r.last_click_at,
  }));
}

/** Переходы по дням (московское время), новые сверху; не больше 90 дней. */
export async function clicksByDay(days: number | null): Promise<{ day: string; linkId: number; count: number }[]> {
  const since = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await query<{ day: string; link_id: number; count: string }>(
    `SELECT to_char(created_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS day, link_id, count(*) AS count
     FROM marketing_link_clicks
     WHERE created_at >= greatest(coalesce($1::timestamptz, '-infinity'), now() - interval '90 days')
     GROUP BY day, link_id ORDER BY day DESC`,
    [since],
  );
  return rows.map((r) => ({ day: r.day, linkId: r.link_id, count: Number(r.count) }));
}
