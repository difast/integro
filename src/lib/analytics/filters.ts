import { services } from "@/config/services";
import { isPaymentStatus, isRequestChannel, isRequestStage, type PaymentStatus, type RequestChannel, type RequestStage } from "@/lib/requests/funnel";
import { isRequestStatus, type RequestStatus } from "@/lib/requests/statuses";

/**
 * Фильтры аналитики. Период — календарные дни по московскому времени, обе границы включительно.
 * Фильтры по заявке (услуга, этап, статус, ответственный, причина отказа, оплата) к диалогам
 * мессенджеров не применяются: у диалога этих свойств нет.
 */
export type AnalyticsFilters = {
  from: string;
  to: string;
  channel: RequestChannel | null;
  service: string | null;
  stage: RequestStage | null;
  status: RequestStatus | null;
  assignee: string | null;
  lossReason: number | null;
  payment: PaymentStatus | null;
};

export const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 3 * 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Сегодняшняя дата в Москве (YYYY-MM-DD). */
export function moscowToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(now);
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function validDay(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseAnalyticsFilters(params: Record<string, string | string[] | undefined>, now = new Date()): AnalyticsFilters {
  const today = moscowToday(now);
  let to = validDay(one(params.to)) ?? today;
  let from = validDay(one(params.from)) ?? shiftDays(to, -(DEFAULT_PERIOD_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  if (shiftDays(from, MAX_PERIOD_DAYS) < to) from = shiftDays(to, -MAX_PERIOD_DAYS);
  const service = one(params.service);
  const assignee = one(params.assignee)?.trim().slice(0, 100);
  const lossReason = one(params.lossReason);
  return {
    from,
    to,
    channel: isRequestChannel(one(params.channel)) ? (one(params.channel) as RequestChannel) : null,
    service: service && services.some((s) => s.slug === service) ? service : null,
    stage: isRequestStage(one(params.stage)) ? (one(params.stage) as RequestStage) : null,
    status: isRequestStatus(one(params.status)) ? (one(params.status) as RequestStatus) : null,
    assignee: assignee || null,
    lossReason: lossReason && /^\d{1,9}$/.test(lossReason) ? Number(lossReason) : null,
    payment: isPaymentStatus(one(params.payment)) ? (one(params.payment) as PaymentStatus) : null,
  };
}

/** Есть ли фильтры, которые относятся только к заявкам. */
export function hasRequestOnlyFilters(f: AnalyticsFilters): boolean {
  return Boolean(f.service || f.stage || f.status || f.assignee || f.lossReason || f.payment);
}

/** Параметры адреса для ссылок (выгрузка CSV с теми же фильтрами). */
export function filtersToSearch(f: AnalyticsFilters): string {
  const params = new URLSearchParams({ from: f.from, to: f.to });
  for (const key of ["channel", "service", "stage", "status", "assignee", "lossReason", "payment"] as const) {
    const value = f[key];
    if (value !== null) params.set(key, String(value));
  }
  return params.toString();
}

/** Доля с числителем и знаменателем; при нулевом знаменателе значения нет (а не 0 %). */
export type Ratio = { numerator: number; denominator: number; value: number | null };
export function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, value: denominator > 0 ? numerator / denominator : null };
}

export function formatPercent(r: Ratio): string {
  if (r.value === null) return "—";
  return `${(r.value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} %`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ч ${minutes % 60} мин`;
  return `${Math.floor(hours / 24)} дн ${hours % 24} ч`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}
