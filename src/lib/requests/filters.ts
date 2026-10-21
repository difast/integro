import { isRequestStatus, type RequestStatus } from "./statuses";

/** Параметры списка заявок в админке (из адресной строки). */
export type RequestFilters = {
  q: string;
  status: RequestStatus | null;
  sort: "new" | "old";
  page: number;
  /** Направление плана продаж: id или "none" — без направления. */
  direction?: string | null;
};

export const PAGE_SIZE = 50;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseFilters(params: RawParams): RequestFilters {
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);
  return {
    q: first(params.q).slice(0, 100),
    status: isRequestStatus(status) ? status : null,
    sort: first(params.sort) === "old" ? "old" : "new",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
    direction: /^[a-z_]{1,30}$/.test(first(params.direction)) ? first(params.direction) : null,
  };
}

/** Строка запроса для ссылок; пустые и значения по умолчанию не включаются. */
export function filtersToSearch(filters: Partial<RequestFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort === "old") params.set("sort", "old");
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Цифры номера для поиска: 8 и +7 в начале российского номера приводятся к общему виду. */
export function searchDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return digits.slice(1);
  return digits;
}

/**
 * Условие WHERE и параметры для поиска и фильтра. Значения передаются только
 * параметрами запроса, в текст SQL пользовательский ввод не подставляется.
 */
export function buildWhere(filters: Pick<RequestFilters, "q" | "status"> & { direction?: string | null }): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.direction === "none") conditions.push("direction_id IS NULL");
  else if (filters.direction) {
    params.push(filters.direction);
    conditions.push(`direction_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${escapeLike(filters.q)}%`);
    const textParam = `$${params.length}`;
    const parts = [`name ILIKE ${textParam}`, `email ILIKE ${textParam}`, `phone ILIKE ${textParam}`];
    const digits = searchDigits(filters.q);
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      parts.push(`phone_digits LIKE $${params.length}`);
    }
    conditions.push(`(${parts.join(" OR ")})`);
  }

  return { sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}
