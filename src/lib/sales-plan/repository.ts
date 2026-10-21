import "server-only";
import { query, withTransaction } from "@/lib/db";
import type { RequestChannel } from "@/lib/requests/funnel";
import { emptyPlanInput, toInputValue, type AutoFacts, type FactSource, type PlanInput } from "./calc";
import { periodToDate, shiftPeriod } from "./period";

/**
 * План продаж: записи sales_plans (месяц × направление) и автоматические факты из заявок CRM.
 *
 * Правила автоматического подсчёта (месяц — по московскому времени):
 * — выручка: сумма «Оплачено» (paid_amount) по заявкам направления со статусом оплаты «частично» или
 *   «полностью», датой оплаты (paid_at) в месяце и валютой RUB;
 * — продажи: число таких заявок (одна заявка — один заказ);
 * — лиды: число уникальных клиентов, оставивших заявку по направлению в месяце (по дате создания):
 *   клиент мессенджера (с учётом связанных карточек), иначе телефон, иначе сама заявка.
 * Заявки без направления, оплаты без даты и оплаты не в рублях в автоматический факт не входят — их число
 * показывается на странице, чтобы администратор мог их классифицировать или дополнить.
 */

export type SalesDirection = { id: string; title: string; serviceSlugs: string[]; sort: number };
export type PlanRecord = { input: PlanInput; version: number; updatedAt: Date };
export type AutoDetails = AutoFacts & { leadsByChannel: Partial<Record<RequestChannel, number>>; paidWithoutDate: number; paidNonRub: number };
export type MonthAuto = {
  byDirection: Record<string, AutoDetails>;
  unclassified: { leads: number; paid: number };
};

export async function listDirections(): Promise<SalesDirection[]> {
  const rows = await query<{ id: string; title: string; service_slugs: string[]; sort: number }>(
    "SELECT id, title, service_slugs, sort FROM sales_directions ORDER BY sort, id",
  );
  return rows.map((r) => ({ id: r.id, title: r.title, serviceSlugs: r.service_slugs, sort: r.sort }));
}

export async function saveDirectionTitles(titles: Record<string, string>): Promise<number> {
  let updated = 0;
  await withTransaction(async (db) => {
    for (const [id, title] of Object.entries(titles)) {
      const { rowCount } = await db.query("UPDATE sales_directions SET title = $2 WHERE id = $1 AND title <> $2", [id, title]);
      updated += rowCount ?? 0;
    }
  });
  return updated;
}

type PlanRow = {
  direction_id: string;
  revenue_plan: string | null;
  sales_plan: number | null;
  leads_plan: number | null;
  revenue_fact: string | null;
  sales_fact: number | null;
  leads_fact: number | null;
  revenue_fact_source: FactSource;
  sales_fact_source: FactSource;
  leads_fact_source: FactSource;
  version: number;
  updated_at: Date;
};

const PLAN_COLUMNS = `direction_id, revenue_plan, sales_plan, leads_plan, revenue_fact, sales_fact, leads_fact,
  revenue_fact_source, sales_fact_source, leads_fact_source, version, updated_at`;

const str = (v: string | number | null) => (v === null ? null : toInputValue(v));

function toRecord(row: PlanRow): PlanRecord {
  return {
    input: {
      revenuePlan: str(row.revenue_plan),
      salesPlan: str(row.sales_plan),
      leadsPlan: str(row.leads_plan),
      revenueFact: str(row.revenue_fact),
      salesFact: str(row.sales_fact),
      leadsFact: str(row.leads_fact),
      revenueSource: row.revenue_fact_source,
      salesSource: row.sales_fact_source,
      leadsSource: row.leads_fact_source,
    },
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function getPlans(period: string): Promise<Record<string, PlanRecord>> {
  const rows = await query<PlanRow>(`SELECT ${PLAN_COLUMNS} FROM sales_plans WHERE period = $1`, [periodToDate(period)]);
  return Object.fromEntries(rows.map((r) => [r.direction_id, toRecord(r)]));
}

/** Проверенные значения для записи (числа уже разобраны на сервере). */
export type PlanValues = {
  revenuePlan: number | null;
  salesPlan: number | null;
  leadsPlan: number | null;
  revenueFact: number | null;
  salesFact: number | null;
  leadsFact: number | null;
  revenueSource: FactSource;
  salesSource: FactSource;
  leadsSource: FactSource;
};
export type PlanChange = { directionId: string; version: number | null; values: PlanValues };

export type SaveResult =
  | { ok: true; saved: Record<string, PlanRecord> }
  /** Запись изменена в другом окне: ничего не сохранено, current — актуальные данные (null — записи нет). */
  | { ok: false; conflicts: Record<string, PlanRecord | null> };

/**
 * Сохраняет записи месяца в одной транзакции. Версия защищает от перезаписи более свежих изменений:
 * обновляется только запись с той версией, которую видел пользователь; новая запись создаётся, только если её ещё нет.
 */
class PlanConflict extends Error {
  constructor(readonly conflicts: Record<string, PlanRecord | null>) {
    super("sales plan version conflict");
  }
}

export async function savePlans(period: string, changes: PlanChange[]): Promise<SaveResult> {
  try {
    return await savePlansTx(periodToDate(period), changes);
  } catch (error) {
    if (error instanceof PlanConflict) return { ok: false, conflicts: error.conflicts };
    throw error;
  }
}

async function savePlansTx(date: string, changes: PlanChange[]): Promise<SaveResult> {
  return withTransaction(async (db) => {
    const saved: Record<string, PlanRecord> = {};
    const conflicts: Record<string, PlanRecord | null> = {};
    for (const change of changes) {
      const v = change.values;
      const params = [date, change.directionId, v.revenuePlan, v.salesPlan, v.leadsPlan, v.revenueFact, v.salesFact, v.leadsFact, v.revenueSource, v.salesSource, v.leadsSource];
      const { rows } =
        change.version === null
          ? await db.query<PlanRow>(
              `INSERT INTO sales_plans (period, direction_id, revenue_plan, sales_plan, leads_plan, revenue_fact, sales_fact, leads_fact,
                 revenue_fact_source, sales_fact_source, leads_fact_source)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (period, direction_id) DO NOTHING RETURNING ${PLAN_COLUMNS}`,
              params,
            )
          : await db.query<PlanRow>(
              `UPDATE sales_plans SET revenue_plan = $3, sales_plan = $4, leads_plan = $5, revenue_fact = $6, sales_fact = $7, leads_fact = $8,
                 revenue_fact_source = $9, sales_fact_source = $10, leads_fact_source = $11, version = version + 1, updated_at = now()
               WHERE period = $1 AND direction_id = $2 AND version = $12 RETURNING ${PLAN_COLUMNS}`,
              [...params, change.version],
            );
      if (rows[0]) {
        saved[change.directionId] = toRecord(rows[0]);
      } else {
        const current = await db.query<PlanRow>(`SELECT ${PLAN_COLUMNS} FROM sales_plans WHERE period = $1 AND direction_id = $2`, [date, change.directionId]);
        conflicts[change.directionId] = current.rows[0] ? toRecord(current.rows[0]) : null;
      }
    }
    // Ничего не сохраняем частично (транзакция откатывается): пользователь решает, как поступить с конфликтом.
    if (Object.keys(conflicts).length) throw new PlanConflict(conflicts);
    return { ok: true, saved };
  });
}

/** Удаляет запись месяца и направления (сброс всех значений). false — запись изменена или уже удалена. */
export async function deletePlan(period: string, directionId: string, version: number): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM sales_plans WHERE period = $1 AND direction_id = $2 AND version = $3 RETURNING id", [
    periodToDate(period),
    directionId,
    version,
  ]);
  return rows.length > 0;
}

// --- Автоматические факты ---

const MONTH_PAID = "r.paid_at >= $1::date AND r.paid_at < ($1::date + interval '1 month')";
const MONTH_CREATED = `r.created_at >= ($1::date)::timestamp AT TIME ZONE 'Europe/Moscow'
  AND r.created_at < (($1::date + interval '1 month')::date)::timestamp AT TIME ZONE 'Europe/Moscow'`;
const LEAD_KEY = "coalesce(c.person_id::text, r.chat_client_id::text, nullif(r.phone_digits, ''), r.id::text)";

export async function getAutoFacts(period: string): Promise<MonthAuto> {
  const date = periodToDate(period);
  const [paid, leads, byChannel, unclassified] = await Promise.all([
    query<{ direction_id: string; revenue: string | null; sales: string; without_date: string; non_rub: string }>(
      `SELECT r.direction_id,
              sum(r.paid_amount) FILTER (WHERE r.currency = 'RUB' AND ${MONTH_PAID}) AS revenue,
              count(*) FILTER (WHERE r.currency = 'RUB' AND ${MONTH_PAID}) AS sales,
              count(*) FILTER (WHERE r.paid_at IS NULL AND ${MONTH_CREATED}) AS without_date,
              count(*) FILTER (WHERE r.currency <> 'RUB' AND ${MONTH_PAID}) AS non_rub
         FROM requests r
        WHERE r.direction_id IS NOT NULL AND r.payment_status <> 'none'
        GROUP BY r.direction_id`,
      [date],
    ),
    query<{ direction_id: string; leads: string }>(
      `SELECT r.direction_id, count(DISTINCT ${LEAD_KEY}) AS leads
         FROM requests r LEFT JOIN chat_clients c ON c.id = r.chat_client_id
        WHERE r.direction_id IS NOT NULL AND ${MONTH_CREATED}
        GROUP BY r.direction_id`,
      [date],
    ),
    query<{ direction_id: string; channel: RequestChannel; leads: string }>(
      `SELECT r.direction_id, r.channel, count(DISTINCT ${LEAD_KEY}) AS leads
         FROM requests r LEFT JOIN chat_clients c ON c.id = r.chat_client_id
        WHERE r.direction_id IS NOT NULL AND ${MONTH_CREATED}
        GROUP BY r.direction_id, r.channel`,
      [date],
    ),
    query<{ leads: string; paid: string }>(
      `SELECT count(*) FILTER (WHERE ${MONTH_CREATED}) AS leads,
              count(*) FILTER (WHERE r.payment_status <> 'none' AND ${MONTH_PAID}) AS paid
         FROM requests r WHERE r.direction_id IS NULL`,
      [date],
    ),
  ]);
  const byDirection: Record<string, AutoDetails> = {};
  const get = (id: string) => (byDirection[id] ??= { revenue: 0, sales: 0, leads: 0, leadsByChannel: {}, paidWithoutDate: 0, paidNonRub: 0 });
  for (const r of paid) {
    const d = get(r.direction_id);
    d.revenue = Number(r.revenue ?? 0);
    d.sales = Number(r.sales);
    d.paidWithoutDate = Number(r.without_date);
    d.paidNonRub = Number(r.non_rub);
  }
  for (const r of leads) get(r.direction_id).leads = Number(r.leads);
  for (const r of byChannel) get(r.direction_id).leadsByChannel[r.channel] = Number(r.leads);
  return { byDirection, unclassified: { leads: Number(unclassified[0]?.leads ?? 0), paid: Number(unclassified[0]?.paid ?? 0) } };
}

export const emptyAuto = (): AutoDetails => ({ revenue: 0, sales: 0, leads: 0, leadsByChannel: {}, paidWithoutDate: 0, paidNonRub: 0 });

// --- История ---

export type HistoryMonth = { period: string; plans: Record<string, PlanInput>; auto: Record<string, AutoFacts> };

/** Сохранённые планы и автоматические факты за months месяцев по period включительно (от старых к новым). */
export async function getHistory(period: string, months = 12): Promise<HistoryMonth[]> {
  const from = periodToDate(shiftPeriod(period, -(months - 1)));
  const to = periodToDate(period);
  const [plans, paid, leads] = await Promise.all([
    query<PlanRow & { period: string }>(`SELECT to_char(period, 'YYYY-MM') AS period, ${PLAN_COLUMNS} FROM sales_plans WHERE period BETWEEN $1 AND $2`, [from, to]),
    query<{ period: string; direction_id: string; revenue: string; sales: string }>(
      `SELECT to_char(date_trunc('month', r.paid_at), 'YYYY-MM') AS period, r.direction_id, sum(r.paid_amount) AS revenue, count(*) AS sales
         FROM requests r
        WHERE r.direction_id IS NOT NULL AND r.payment_status <> 'none' AND r.currency = 'RUB'
          AND r.paid_at >= $1::date AND r.paid_at < ($2::date + interval '1 month')
        GROUP BY 1, 2`,
      [from, to],
    ),
    query<{ period: string; direction_id: string; leads: string }>(
      `SELECT to_char(date_trunc('month', r.created_at AT TIME ZONE 'Europe/Moscow'), 'YYYY-MM') AS period, r.direction_id, count(DISTINCT ${LEAD_KEY}) AS leads
         FROM requests r LEFT JOIN chat_clients c ON c.id = r.chat_client_id
        WHERE r.direction_id IS NOT NULL
          AND r.created_at >= ($1::date)::timestamp AT TIME ZONE 'Europe/Moscow'
          AND r.created_at < (($2::date + interval '1 month')::date)::timestamp AT TIME ZONE 'Europe/Moscow'
        GROUP BY 1, 2`,
      [from, to],
    ),
  ]);
  const result: HistoryMonth[] = [];
  for (let i = months - 1; i >= 0; i--) result.push({ period: shiftPeriod(period, -i), plans: {}, auto: {} });
  const month = (p: string) => result.find((m) => m.period === p);
  for (const r of plans) {
    const m = month(r.period);
    if (m) m.plans[r.direction_id] = toRecord(r).input;
  }
  const auto = (m: HistoryMonth, id: string) => (m.auto[id] ??= { revenue: 0, sales: 0, leads: 0 });
  for (const r of paid) {
    const m = month(r.period);
    if (m) Object.assign(auto(m, r.direction_id), { revenue: Number(r.revenue), sales: Number(r.sales) });
  }
  for (const r of leads) {
    const m = month(r.period);
    if (m) auto(m, r.direction_id).leads = Number(r.leads);
  }
  return result;
}

export { emptyPlanInput };
