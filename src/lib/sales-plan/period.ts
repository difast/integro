/** Период плана продаж — календарный месяц по московскому времени, в формате YYYY-MM. */

export const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isPeriod(value: unknown): value is string {
  if (typeof value !== "string" || !PERIOD_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

export function currentPeriod(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
}

export function shiftPeriod(period: string, months: number): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1 + months;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Первое число месяца — значение столбца period (date). */
export const periodToDate = (period: string) => `${period}-01`;

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function periodLabel(period: string): string {
  const name = MONTHS[Number(period.slice(5, 7)) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${period.slice(0, 4)}`;
}

export function periodShortLabel(period: string): string {
  return `${MONTHS_SHORT[Number(period.slice(5, 7)) - 1] ?? ""} ${period.slice(2, 4)}`;
}

export const monthNames = MONTHS.map((m) => `${m.charAt(0).toUpperCase()}${m.slice(1)}`);
