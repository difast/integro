import "server-only";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { buildWhere, PAGE_SIZE, searchDigits, type RequestFilters } from "./filters";
import type { RequestStatus } from "./statuses";

export type RequestRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  phone: string;
  email: string;
  service: string;
  serviceTitle: string;
  message: string;
  status: RequestStatus;
  notes: string;
  sourcePage: string | null;
  context: string | null;
  consentRevision: string;
  channel: "site" | "max";
  maxClientId: string | null;
};

export type RequestListItem = Pick<RequestRecord, "id" | "createdAt" | "name" | "phone" | "email" | "serviceTitle" | "status" | "channel">;

type Row = {
  id: string;
  created_at: Date;
  updated_at: Date;
  name: string;
  phone: string;
  email: string;
  service: string;
  service_title: string;
  message: string;
  status: RequestStatus;
  notes: string;
  source_page: string | null;
  context: string | null;
  consent_revision: string;
  channel: "site" | "max";
  max_client_id: string | null;
};

const FULL_COLUMNS =
  "id, created_at, updated_at, name, phone, email, service, service_title, message, status, notes, source_page, context, consent_revision, channel, max_client_id";

function toRecord(row: Row): RequestRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    phone: row.phone,
    email: row.email,
    service: row.service,
    serviceTitle: row.service_title,
    message: row.message,
    status: row.status,
    notes: row.notes,
    sourcePage: row.source_page,
    context: row.context,
    consentRevision: row.consent_revision,
    channel: row.channel,
    maxClientId: row.max_client_id,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type NewRequest = {
  submissionKey: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  serviceTitle: string;
  message: string;
  sourcePage: string | null;
  context: string | null;
  consentRevision: string;
  /** Канал: форма на сайте (по умолчанию) или чат-бот MAX. */
  channel?: "site" | "max";
  maxClientId?: string | null;
};

type Executor = Pick<PoolClient, "query">;

/**
 * Сохраняет заявку. Повторная отправка с тем же ключом (двойное нажатие, повтор
 * запроса) не создаёт дубликат: возвращается { created: false } и id существующей записи.
 */
export async function createRequest(input: NewRequest, db?: Executor): Promise<{ id: string; created: boolean }> {
  const run = async <T extends { id: string }>(sql: string, params: unknown[]): Promise<T[]> =>
    db ? (await db.query<T>(sql, params)).rows : query<T>(sql, params);
  const inserted = await run<{ id: string }>(
    `INSERT INTO requests (submission_key, name, phone, phone_digits, email, service, service_title, message, source_page, consent_revision, context, channel, max_client_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (submission_key) DO NOTHING
     RETURNING id`,
    [
      input.submissionKey,
      input.name,
      input.phone,
      searchDigits(input.phone),
      input.email,
      input.service,
      input.serviceTitle,
      input.message,
      input.sourcePage,
      input.consentRevision,
      input.context,
      input.channel ?? "site",
      input.maxClientId ?? null,
    ],
  );
  if (inserted[0]) return { id: inserted[0].id, created: true };

  const existing = await run<{ id: string }>("SELECT id FROM requests WHERE submission_key = $1", [input.submissionKey]);
  if (!existing[0]) throw new Error("request insert conflict without existing row");
  return { id: existing[0].id, created: false };
}

export async function listRequests(
  filters: RequestFilters,
): Promise<{ items: RequestListItem[]; total: number; pageCount: number }> {
  const where = buildWhere(filters);
  const order = filters.sort === "old" ? "created_at ASC, id ASC" : "created_at DESC, id DESC";
  const offset = (filters.page - 1) * PAGE_SIZE;

  const [rows, countRows] = await Promise.all([
    query<Row>(
      `SELECT ${FULL_COLUMNS} FROM requests ${where.sql} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      where.params,
    ),
    query<{ count: string }>(`SELECT count(*) AS count FROM requests ${where.sql}`, where.params),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  return {
    items: rows.map(toRecord),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Все заявки по фильтру — для выгрузки в CSV. */
export async function listRequestsForExport(filters: Pick<RequestFilters, "q" | "status" | "sort">): Promise<RequestRecord[]> {
  const where = buildWhere(filters);
  const order = filters.sort === "old" ? "created_at ASC, id ASC" : "created_at DESC, id DESC";
  const rows = await query<Row>(`SELECT ${FULL_COLUMNS} FROM requests ${where.sql} ORDER BY ${order}`, where.params);
  return rows.map(toRecord);
}

/** Количество заявок по статусам и всего. */
export async function countRequests(): Promise<{ total: number; byStatus: Record<string, number> }> {
  const rows = await query<{ status: string; count: string }>(
    "SELECT status, count(*) AS count FROM requests GROUP BY status",
  );
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = Number(row.count);
    total += Number(row.count);
  }
  return { total, byStatus };
}

export async function getRequest(id: string): Promise<RequestRecord | null> {
  if (!isUuid(id)) return null;
  const rows = await query<Row>(`SELECT ${FULL_COLUMNS} FROM requests WHERE id = $1`, [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function updateRequest(id: string, changes: { status: RequestStatus; notes: string }): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE requests SET status = $2, notes = $3, updated_at = now() WHERE id = $1 RETURNING id",
    [id, changes.status, changes.notes],
  );
  return rows.length > 0;
}

export async function deleteRequest(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>("DELETE FROM requests WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

/** Заявки клиента чат-бота MAX — для карточки клиента. */
export async function listRequestsByMaxClient(maxClientId: string): Promise<RequestListItem[]> {
  if (!isUuid(maxClientId)) return [];
  const rows = await query<Row>(
    `SELECT ${FULL_COLUMNS} FROM requests WHERE max_client_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [maxClientId],
  );
  return rows.map(toRecord);
}
