/**
 * Расчёты плана продаж. Хранятся только исходные значения (план, ручной факт); всё остальное
 * вычисляется здесь — одинаково в таблице, карточках, истории и тестах. Округление — только при выводе.
 * null — «не заполнено» (не ноль); деление на ноль или на пустое значение даёт null («—»).
 */

export type FactSource = "auto" | "manual";
export const FACT_METRICS = ["revenue", "sales", "leads"] as const;
export type FactMetric = (typeof FACT_METRICS)[number];

/** Сохранённая запись месяца и направления (числа — как строки из формы или базы). */
export type PlanInput = {
  revenuePlan: string | null;
  salesPlan: string | null;
  leadsPlan: string | null;
  revenueFact: string | null;
  salesFact: string | null;
  leadsFact: string | null;
  revenueSource: FactSource;
  salesSource: FactSource;
  leadsSource: FactSource;
};

export const emptyPlanInput = (): PlanInput => ({
  revenuePlan: null,
  salesPlan: null,
  leadsPlan: null,
  revenueFact: null,
  salesFact: null,
  leadsFact: null,
  revenueSource: "auto",
  salesSource: "auto",
  leadsSource: "auto",
});

/** Автоматические факты месяца по направлению (из заявок и оплат CRM). */
export type AutoFacts = { revenue: number; sales: number; leads: number };

// --- Разбор и проверка значений (на клиенте и, повторно, на сервере) ---

const MAX_MONEY = 999_999_999_999.99;
const MAX_COUNT = 10_000_000;

export type Parsed<T> = { ok: true; value: T | null } | { ok: false; error: string };

/** Сумма в рублях: «1 250 000,50» → 1250000.5; пусто → null. Отрицательные и лишние знаки — ошибка. */
export function parseMoneyValue(raw: string | null | undefined): Parsed<number> {
  const text = (raw ?? "").replace(/[\s ₽]/g, "").replace(",", ".");
  if (!text) return { ok: true, value: null };
  if (text.startsWith("-")) return { ok: false, error: "Сумма не может быть отрицательной" };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Число, например 150000 или 150 000,50" };
  const value = Number(text);
  return value > MAX_MONEY ? { ok: false, error: "Слишком большая сумма" } : { ok: true, value };
}

/** Количество (продажи, лиды): целое неотрицательное; пусто → null. */
export function parseCountValue(raw: string | null | undefined): Parsed<number> {
  const text = (raw ?? "").replace(/[\s ]/g, "");
  if (!text) return { ok: true, value: null };
  if (text.startsWith("-")) return { ok: false, error: "Не может быть отрицательным" };
  if (!/^\d{1,8}$/.test(text)) return { ok: false, error: "Целое число" };
  const value = Number(text);
  return value > MAX_COUNT ? { ok: false, error: "Слишком большое число" } : { ok: true, value };
}

export const parsers = {
  revenuePlan: parseMoneyValue,
  revenueFact: parseMoneyValue,
  salesPlan: parseCountValue,
  salesFact: parseCountValue,
  leadsPlan: parseCountValue,
  leadsFact: parseCountValue,
} as const;
export type NumberField = keyof typeof parsers;
export const NUMBER_FIELDS = Object.keys(parsers) as NumberField[];

const num = (field: NumberField, raw: string | null): number | null => {
  const parsed = parsers[field](raw);
  return parsed.ok ? parsed.value : null;
};

// --- Метрики ---

const div = (a: number | null, b: number | null): number | null => (a === null || b === null || b === 0 ? null : a / b);
const diff = (fact: number | null, plan: number | null): number | null => (fact === null || plan === null ? null : fact - plan);

export type MetricRow = {
  plan: number | null;
  fact: number | null;
  /** Факт − план (для конверсии — в процентных пунктах). */
  deviation: number | null;
  /** Факт / план × 100 — выполнение плана, %. */
  completion: number | null;
};

export type DirectionMetrics = {
  revenue: MetricRow;
  sales: MetricRow;
  averageCheck: MetricRow;
  leads: MetricRow;
  /** Конверсия в продажу, % (plan/fact — проценты, deviation — п.п.). */
  conversion: MetricRow;
  sources: Record<FactMetric, FactSource>;
};

function row(plan: number | null, fact: number | null): MetricRow {
  const completion = div(fact, plan);
  return { plan, fact, deviation: diff(fact, plan), completion: completion === null ? null : completion * 100 };
}

/** Фактическое значение: автоматическое (из CRM) или введённое вручную. */
export function effectiveFact(input: PlanInput, auto: AutoFacts | null, metric: FactMetric): number | null {
  const source = input[`${metric}Source`];
  if (source === "auto") return auto ? auto[metric] : null;
  return num(`${metric}Fact`, input[`${metric}Fact`]);
}

export function computeMetrics(input: PlanInput, auto: AutoFacts | null): DirectionMetrics {
  return fromValues(
    {
      revenuePlan: num("revenuePlan", input.revenuePlan),
      salesPlan: num("salesPlan", input.salesPlan),
      leadsPlan: num("leadsPlan", input.leadsPlan),
      revenueFact: effectiveFact(input, auto, "revenue"),
      salesFact: effectiveFact(input, auto, "sales"),
      leadsFact: effectiveFact(input, auto, "leads"),
    },
    { revenue: input.revenueSource, sales: input.salesSource, leads: input.leadsSource },
  );
}

type Values = Record<"revenuePlan" | "salesPlan" | "leadsPlan" | "revenueFact" | "salesFact" | "leadsFact", number | null>;

function fromValues(v: Values, sources: Record<FactMetric, FactSource>): DirectionMetrics {
  const checkPlan = div(v.revenuePlan, v.salesPlan);
  const checkFact = div(v.revenueFact, v.salesFact);
  const convPlan = div(v.salesPlan, v.leadsPlan);
  const convFact = div(v.salesFact, v.leadsFact);
  return {
    revenue: row(v.revenuePlan, v.revenueFact),
    sales: row(v.salesPlan, v.salesFact),
    averageCheck: { ...row(checkPlan, checkFact), completion: null },
    leads: row(v.leadsPlan, v.leadsFact),
    conversion: conversionRow(convPlan, convFact),
    sources,
  };
}

/** Конверсия в процентах; отклонение — разность процентов (п.п.), чтобы 31,25 − 20 давало ровно 11,25. */
function conversionRow(planShare: number | null, factShare: number | null): MetricRow {
  const plan = planShare === null ? null : planShare * 100;
  const fact = factShare === null ? null : factShare * 100;
  return { plan, fact, deviation: diff(fact, plan), completion: null };
}

const sum = (values: (number | null)[]): number | null => (values.every((x) => x === null) ? null : values.reduce<number>((a, x) => a + (x ?? 0), 0));

/** Сумма по парам, где известны оба значения (для среднего чека и конверсии итога). */
function pairSum(list: DirectionMetrics[], a: (m: DirectionMetrics) => number | null, b: (m: DirectionMetrics) => number | null): [number | null, number | null] {
  const pairs = list.filter((m) => a(m) !== null && b(m) !== null);
  if (!pairs.length) return [null, null];
  return [pairs.reduce((s, m) => s + a(m)!, 0), pairs.reduce((s, m) => s + b(m)!, 0)];
}

/**
 * Итог по всем направлениям: выручка, продажи и лиды суммируются; средний чек = сумма выручки / сумма продаж,
 * конверсия = сумма продаж / сумма лидов (не среднее конверсий). В средний чек и конверсию итога входят
 * направления, где известны оба значения пары.
 */
export function computeTotals(list: DirectionMetrics[]): DirectionMetrics {
  const totals = {
    revenuePlan: sum(list.map((m) => m.revenue.plan)),
    salesPlan: sum(list.map((m) => m.sales.plan)),
    leadsPlan: sum(list.map((m) => m.leads.plan)),
    revenueFact: sum(list.map((m) => m.revenue.fact)),
    salesFact: sum(list.map((m) => m.sales.fact)),
    leadsFact: sum(list.map((m) => m.leads.fact)),
  };
  const base = fromValues(totals, { revenue: "auto", sales: "auto", leads: "auto" });
  const [rp, sp] = pairSum(list, (m) => m.revenue.plan, (m) => m.sales.plan);
  const [rf, sf] = pairSum(list, (m) => m.revenue.fact, (m) => m.sales.fact);
  const [spc, lp] = pairSum(list, (m) => m.sales.plan, (m) => m.leads.plan);
  const [sfc, lf] = pairSum(list, (m) => m.sales.fact, (m) => m.leads.fact);
  const checkPlan = div(rp, sp);
  const checkFact = div(rf, sf);
  const convPlan = div(spc, lp);
  const convFact = div(sfc, lf);
  return {
    ...base,
    averageCheck: { plan: checkPlan, fact: checkFact, deviation: diff(checkFact, checkPlan), completion: null },
    conversion: conversionRow(convPlan, convFact),
  };
}

// --- Вывод ---

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rubPrecise = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const DASH = "—";

export function formatRub(value: number | null, precise = false): string {
  return value === null ? DASH : `${(precise ? rubPrecise : rub).format(value)} ₽`;
}
export function formatCount(value: number | null): string {
  return value === null ? DASH : int.format(value);
}
export function formatPercent(value: number | null): string {
  return value === null ? DASH : `${pct.format(value)} %`;
}

/** Отклонение со знаком: «+12 000 ₽», «−3», «+2,5 п.п.». */
export function formatDeviation(value: number | null, kind: "rub" | "count" | "pp"): string {
  if (value === null) return DASH;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const text = kind === "rub" ? `${rub.format(abs)} ₽` : kind === "count" ? int.format(abs) : `${pct.format(abs)} п.п.`;
  return `${sign}${text}`;
}

/** Строка для поля ввода из числа базы («150000.00» → «150000»). */
export function toInputValue(value: string | number | null): string {
  if (value === null || value === "") return "";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}
