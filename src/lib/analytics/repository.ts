import "server-only";
import { query } from "@/lib/db";
import { channelLabel, requestChannels, type RequestChannel } from "@/lib/requests/funnel";
import { ratio, type AnalyticsFilters, type Ratio } from "./filters";

/**
 * Показатели воронки — только из данных БД, на сервере. Когорты:
 * — диалоги мессенджеров: начатые в периоде (chat_clients.first_seen_at);
 * — заявки: созданные в периоде (requests.created_at), со всеми фильтрами по заявке.
 * Деньги не суммируются между валютами: итоги — отдельно по каждой валюте.
 */

const CHAT_CHANNELS: RequestChannel[] = ["max", "telegram"];

type Where = { sql: string; params: unknown[] };

function periodParams(f: AnalyticsFilters): unknown[] {
  return [f.from, f.to];
}
const PERIOD = (column: string) =>
  `${column} >= ($1::date)::timestamp AT TIME ZONE 'Europe/Moscow' AND ${column} < ($2::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow'`;

function requestWhere(f: AnalyticsFilters): Where {
  const params = periodParams(f);
  const parts = [PERIOD("r.created_at")];
  const add = (sql: (n: number) => string, value: unknown) => {
    params.push(value);
    parts.push(sql(params.length));
  };
  if (f.channel) add((n) => `r.channel = $${n}`, f.channel);
  if (f.service) add((n) => `r.service = $${n}`, f.service);
  if (f.stage) add((n) => `r.stage = $${n}`, f.stage);
  if (f.status) add((n) => `r.status = $${n}`, f.status);
  if (f.assignee) add((n) => `r.assignee = $${n}`, f.assignee);
  if (f.lossReason) add((n) => `r.loss_reason_id = $${n}`, f.lossReason);
  if (f.payment) add((n) => `r.payment_status = $${n}`, f.payment);
  return { sql: parts.join(" AND "), params };
}

/** Диалоги считаются, только если фильтр канала не задан или это мессенджер с ботом. */
function dialogWhere(f: AnalyticsFilters): Where | null {
  if (f.channel && !CHAT_CHANNELS.includes(f.channel)) return null;
  const params = periodParams(f);
  let sql = PERIOD("c.first_seen_at");
  if (f.channel) {
    params.push(f.channel);
    sql += ` AND c.channel = $${params.length}`;
  }
  return { sql, params };
}

// Заявка «дошла» до этапа, если она сейчас на нём или дальше (кроме «проиграна»), либо была на нём по истории.
const REACHED = (stages: string[]) => {
  const list = stages.map((s) => `'${s}'`).join(", ");
  return `(r.stage IN (${list}) OR EXISTS (SELECT 1 FROM request_history h WHERE h.request_id = r.id AND h.field = 'stage' AND h.new_value IN (${list})))`;
};

export type Duration = { count: number; averageSeconds: number | null; medianSeconds: number | null };
export type MoneyRow = { currency: string; paid: number; paidCount: number; contract: number; contractCount: number; averageCheck: number | null };
export type ChannelRow = { channel: RequestChannel; label: string; dialogs: number | null; requests: number; won: number; lost: number; paidRub: number; winRate: Ratio };
export type FunnelStep = { key: string; label: string; count: number | null; fromPrevious: Ratio | null; note?: string };

export type AnalyticsReport = {
  dialogs: null | {
    total: number;
    uniquePeople: number;
    qualified: number;
    withRequest: number;
    unanswered: number;
    firstReply: Duration;
    unansweredShare: Ratio;
  };
  requests: {
    total: number;
    withoutDialog: number;
    uniquePhones: number;
    withoutPhone: number;
    negotiation: number;
    priced: number;
    won: number;
    lost: number;
    contactToRequest: Duration;
  };
  money: MoneyRow[];
  lossReasons: { title: string; count: number }[];
  channels: ChannelRow[];
  funnel: FunnelStep[];
  conversions: { key: string; label: string; ratio: Ratio; formula: string }[];
};

type DurationRow = { count: string; avg: string | null; median: string | null };
const toDuration = (row: DurationRow | undefined): Duration => ({
  count: Number(row?.count ?? 0),
  averageSeconds: row?.avg === null || row?.avg === undefined ? null : Math.round(Number(row.avg)),
  medianSeconds: row?.median === null || row?.median === undefined ? null : Math.round(Number(row.median)),
});
const DURATION_SQL = (expr: string) =>
  `count(${expr}) AS count, avg(${expr}) AS avg, percentile_cont(0.5) WITHIN GROUP (ORDER BY ${expr}) AS median`;

async function loadDialogs(f: AnalyticsFilters) {
  const where = dialogWhere(f);
  if (!where) return { summary: null, byChannel: new Map<string, number>() };
  const [summary, firstReply, byChannel] = await Promise.all([
    query<{ total: string; people: string; qualified: string; with_request: string; unanswered: string }>(
      `SELECT count(*) AS total,
              count(DISTINCT coalesce(c.person_id, c.id)) AS people,
              count(*) FILTER (WHERE c.qualified_at IS NOT NULL OR EXISTS (SELECT 1 FROM requests r WHERE r.chat_client_id = c.id)) AS qualified,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM requests r WHERE r.chat_client_id = c.id)) AS with_request,
              count(*) FILTER (WHERE c.needs_reply AND c.status = 'open') AS unanswered
         FROM chat_clients c WHERE ${where.sql}`,
      where.params,
    ),
    // Время до первого ответа оператора: от первого сообщения клиента до первого доставленного ответа оператора после него.
    query<DurationRow>(
      `WITH t AS (
         SELECT (SELECT min(m.created_at) FROM chat_messages m WHERE m.client_id = c.id AND m.direction = 'in' AND m.author = 'client') AS first_in,
                c.id
           FROM chat_clients c WHERE ${where.sql}
       ), d AS (
         SELECT extract(epoch FROM (SELECT min(m.created_at) FROM chat_messages m
                  WHERE m.client_id = t.id AND m.author = 'operator' AND m.status = 'sent' AND m.created_at >= t.first_in) - t.first_in) AS seconds
           FROM t WHERE t.first_in IS NOT NULL
       )
       SELECT ${DURATION_SQL("seconds")} FROM d`,
      where.params,
    ),
    query<{ channel: string; count: string }>(`SELECT c.channel, count(*) AS count FROM chat_clients c WHERE ${where.sql} GROUP BY c.channel`, where.params),
  ]);
  const row = summary[0];
  const total = Number(row?.total ?? 0);
  const unanswered = Number(row?.unanswered ?? 0);
  return {
    summary: {
      total,
      uniquePeople: Number(row?.people ?? 0),
      qualified: Number(row?.qualified ?? 0),
      withRequest: Number(row?.with_request ?? 0),
      unanswered,
      firstReply: toDuration(firstReply[0]),
      unansweredShare: ratio(unanswered, total),
    },
    byChannel: new Map(byChannel.map((r) => [r.channel, Number(r.count)])),
  };
}

async function loadRequests(f: AnalyticsFilters) {
  const where = requestWhere(f);
  const [summary, timing, money, reasons, byChannel] = await Promise.all([
    query<Record<"total" | "without_dialog" | "phones" | "without_phone" | "negotiation" | "priced" | "won" | "lost", string>>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE r.chat_client_id IS NULL) AS without_dialog,
              count(DISTINCT nullif(r.phone_digits, '')) AS phones,
              count(*) FILTER (WHERE r.phone_digits = '') AS without_phone,
              count(*) FILTER (WHERE ${REACHED(["negotiation", "priced", "won"])}) AS negotiation,
              count(*) FILTER (WHERE ${REACHED(["priced", "won"])}) AS priced,
              count(*) FILTER (WHERE r.stage = 'won') AS won,
              count(*) FILTER (WHERE r.stage = 'lost') AS lost
         FROM requests r WHERE ${where.sql}`,
      where.params,
    ),
    query<DurationRow>(
      `SELECT ${DURATION_SQL("extract(epoch FROM r.created_at - c.first_seen_at)")}
         FROM requests r JOIN chat_clients c ON c.id = r.chat_client_id WHERE ${where.sql}`,
      where.params,
    ),
    query<{ currency: string; paid: string | null; paid_count: string; contract: string | null; contract_count: string }>(
      `SELECT r.currency,
              sum(r.paid_amount) FILTER (WHERE r.payment_status <> 'none') AS paid,
              count(r.paid_amount) FILTER (WHERE r.payment_status <> 'none') AS paid_count,
              sum(r.deal_amount) FILTER (WHERE r.stage = 'won') AS contract,
              count(r.deal_amount) FILTER (WHERE r.stage = 'won') AS contract_count
         FROM requests r WHERE ${where.sql}
        GROUP BY r.currency
       HAVING count(r.paid_amount) FILTER (WHERE r.payment_status <> 'none') > 0 OR count(r.deal_amount) FILTER (WHERE r.stage = 'won') > 0
        ORDER BY (r.currency = 'RUB') DESC, r.currency`,
      where.params,
    ),
    query<{ title: string | null; count: string }>(
      `SELECT lr.title, count(*) AS count FROM requests r LEFT JOIN loss_reasons lr ON lr.id = r.loss_reason_id
        WHERE ${where.sql} AND r.stage = 'lost' GROUP BY lr.title ORDER BY count(*) DESC, lr.title`,
      where.params,
    ),
    query<{ channel: RequestChannel; total: string; won: string; lost: string; paid_rub: string | null }>(
      `SELECT r.channel, count(*) AS total,
              count(*) FILTER (WHERE r.stage = 'won') AS won,
              count(*) FILTER (WHERE r.stage = 'lost') AS lost,
              sum(r.paid_amount) FILTER (WHERE r.payment_status <> 'none' AND r.currency = 'RUB') AS paid_rub
         FROM requests r WHERE ${where.sql} GROUP BY r.channel`,
      where.params,
    ),
  ]);
  const s = summary[0];
  const n = (key: keyof NonNullable<typeof s>) => Number(s?.[key] ?? 0);
  return {
    summary: {
      total: n("total"),
      withoutDialog: n("without_dialog"),
      uniquePhones: n("phones"),
      withoutPhone: n("without_phone"),
      negotiation: n("negotiation"),
      priced: n("priced"),
      won: n("won"),
      lost: n("lost"),
      contactToRequest: toDuration(timing[0]),
    },
    money: money.map((m): MoneyRow => {
      const contract = Number(m.contract ?? 0);
      const contractCount = Number(m.contract_count);
      return {
        currency: m.currency,
        paid: Number(m.paid ?? 0),
        paidCount: Number(m.paid_count),
        contract,
        contractCount,
        averageCheck: contractCount > 0 ? contract / contractCount : null,
      };
    }),
    lossReasons: reasons.map((r) => ({ title: r.title ?? "Причина не указана", count: Number(r.count) })),
    byChannel,
  };
}

export async function getAnalyticsReport(f: AnalyticsFilters): Promise<AnalyticsReport> {
  const [dialogs, requests] = await Promise.all([loadDialogs(f), loadRequests(f)]);
  const d = dialogs.summary;
  const r = requests.summary;

  const channels: ChannelRow[] = requestChannels
    .map(({ value }) => {
      const row = requests.byChannel.find((c) => c.channel === value);
      const won = Number(row?.won ?? 0);
      const lost = Number(row?.lost ?? 0);
      return {
        channel: value,
        label: channelLabel(value),
        dialogs: CHAT_CHANNELS.includes(value) && d ? (dialogs.byChannel.get(value) ?? 0) : null,
        requests: Number(row?.total ?? 0),
        won,
        lost,
        paidRub: Number(row?.paid_rub ?? 0),
        winRate: ratio(won, won + lost),
      };
    })
    .filter((c) => !f.channel || c.channel === f.channel)
    .filter((c) => c.requests > 0 || (c.dialogs ?? 0) > 0 || f.channel === c.channel);

  const contacts = d ? d.total + r.withoutDialog : null;
  const qualified = d ? d.qualified + r.withoutDialog : null;
  const step = (key: string, label: string, count: number | null, previous: number | null, note?: string): FunnelStep => ({
    key,
    label,
    count,
    fromPrevious: count === null || previous === null ? null : ratio(count, previous),
    note,
  });
  const funnel: FunnelStep[] = [
    step("contact", "Первичное обращение", contacts, null, "Диалоги в мессенджерах, начатые в периоде, и заявки без диалога (сайт, ручные)"),
    step("qualified", "Квалифицированный лид", qualified, contacts, "Диалоги с отметкой оператора или с заявкой, и заявки без диалога"),
    step("request", "Заявка", r.total, qualified),
    step("negotiation", "Переговоры", r.negotiation, r.total),
    step("priced", "Стоимость согласована / счёт", r.priced, r.negotiation),
    step("won", "Сделка выиграна", r.won, r.priced),
    step("lost", "Сделка проиграна", r.lost, null, "Отдельный исход, не следующий шаг воронки"),
  ];

  const conversions = [
    { key: "dialog_request", label: "Диалог → заявка", ratio: d ? ratio(d.withRequest, d.total) : ratio(0, 0), formula: "диалоги периода с заявкой / диалоги периода" },
    { key: "contact_request", label: "Обращение → заявка", ratio: contacts === null ? ratio(0, 0) : ratio(r.total, contacts), formula: "заявки периода / первичные обращения" },
    { key: "qualified_request", label: "Квалифицированный лид → заявка", ratio: qualified === null ? ratio(0, 0) : ratio(r.total, qualified), formula: "заявки периода / квалифицированные лиды" },
    { key: "request_won", label: "Заявка → выигранная сделка", ratio: ratio(r.won, r.total), formula: "выигранные / все заявки периода" },
    { key: "win_rate", label: "Доля выигранных среди закрытых", ratio: ratio(r.won, r.won + r.lost), formula: "выигранные / (выигранные + проигранные)" },
  ];

  return {
    dialogs: d,
    requests: r,
    money: requests.money,
    lossReasons: requests.lossReasons,
    channels,
    funnel,
    conversions,
  };
}

export type AnalyticsRequestRow = {
  id: string;
  createdAt: Date;
  channel: string;
  serviceTitle: string;
  status: string;
  stage: string;
  lossReason: string | null;
  assignee: string | null;
  dealAmount: string | null;
  currency: string;
  paymentStatus: string;
  paidAmount: string | null;
  paidAt: string | null;
  attribution: Record<string, string> | null;
};

/** Заявки для выгрузки аналитики — без имени, телефона, почты и текста обращения. */
export async function listAnalyticsRequests(f: AnalyticsFilters): Promise<AnalyticsRequestRow[]> {
  const where = requestWhere(f);
  const rows = await query<{
    id: string;
    created_at: Date;
    channel: string;
    service_title: string;
    status: string;
    stage: string;
    loss_reason: string | null;
    assignee: string | null;
    deal_amount: string | null;
    currency: string;
    payment_status: string;
    paid_amount: string | null;
    paid_at: string | null;
    attribution: Record<string, string> | null;
  }>(
    `SELECT r.id, r.created_at, r.channel, r.service_title, r.status, r.stage, lr.title AS loss_reason, r.assignee,
            r.deal_amount::text AS deal_amount, r.currency, r.payment_status, r.paid_amount::text AS paid_amount,
            to_char(r.paid_at, 'YYYY-MM-DD') AS paid_at, r.attribution
       FROM requests r LEFT JOIN loss_reasons lr ON lr.id = r.loss_reason_id
      WHERE ${where.sql} ORDER BY r.created_at DESC LIMIT 10000`,
    where.params,
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    channel: row.channel,
    serviceTitle: row.service_title,
    status: row.status,
    stage: row.stage,
    lossReason: row.loss_reason,
    assignee: row.assignee,
    dealAmount: row.deal_amount,
    currency: row.currency,
    paymentStatus: row.payment_status,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at,
    attribution: row.attribution,
  }));
}
