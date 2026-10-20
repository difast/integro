/** Фильтры списка обращений MAX (разбор параметров адреса и построение условия SQL). */

/** Максимальная длина текста сообщения в MAX. */
export const REPLY_MAX_LENGTH = 4000;

export const MAX_PAGE_SIZE = 30;

export const maxDialogFilters = [
  { value: "", label: "Все" },
  { value: "needs_reply", label: "Ждут ответа" },
  { value: "open", label: "В работе" },
  { value: "closed", label: "Закрытые" },
] as const;
export type MaxDialogFilter = (typeof maxDialogFilters)[number]["value"];

export const maxPeriods = [
  { value: "", label: "За всё время", days: null },
  { value: "1", label: "Сутки", days: 1 },
  { value: "7", label: "7 дней", days: 7 },
  { value: "30", label: "30 дней", days: 30 },
] as const;

export type MaxFilters = { q: string; filter: MaxDialogFilter; period: (typeof maxPeriods)[number]["value"]; page: number };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseMaxFilters(params: Record<string, string | string[] | undefined>): MaxFilters {
  const filterValue = first(params.filter);
  const periodValue = first(params.period);
  const page = Number.parseInt(first(params.page), 10);
  return {
    q: first(params.q).trim().slice(0, 100),
    filter: maxDialogFilters.find((f) => f.value === filterValue)?.value ?? "",
    period: maxPeriods.find((p) => p.value === periodValue)?.value ?? "",
    page: Number.isFinite(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

export function maxFiltersToSearch(filters: Partial<MaxFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.filter) params.set("filter", filters.filter);
  if (filters.period) params.set("period", filters.period);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Условие WHERE для таблицы max_clients (псевдоним c). Значения — только через параметры. */
export function buildMaxWhere(filters: MaxFilters): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.filter === "needs_reply") parts.push("c.needs_reply AND c.status = 'open'");
  if (filters.filter === "open") parts.push("c.status = 'open'");
  if (filters.filter === "closed") parts.push("c.status = 'closed'");

  const period = maxPeriods.find((p) => p.value === filters.period);
  if (period?.days) parts.push(`c.last_seen_at >= now() - make_interval(days => ${add(period.days)})`);

  if (filters.q) {
    const like = add(`%${escapeLike(filters.q.toLowerCase())}%`);
    const or = [
      `lower(c.first_name || ' ' || c.last_name) LIKE ${like}`,
      `lower(coalesce(c.username, '')) LIKE ${like}`,
      `EXISTS (SELECT 1 FROM max_messages m WHERE m.client_id = c.id AND lower(m.text) LIKE ${like})`,
    ];
    if (/^\d{3,20}$/.test(filters.q)) or.push(`c.max_user_id::text = ${add(filters.q)}`);
    const digits = filters.q.replace(/\D/g, "");
    if (digits.length >= 5) {
      const normalized = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
      or.push(`c.phone_digits LIKE ${add(`%${normalized}%`)}`);
      or.push(`EXISTS (SELECT 1 FROM requests r WHERE r.max_client_id = c.id AND r.phone_digits LIKE ${add(`%${normalized}%`)})`);
    }
    parts.push(`(${or.join(" OR ")})`);
  }

  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}
