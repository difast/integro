import "server-only";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { recordChanges } from "./history";
import type { Attribution } from "./attribution";
import type { PaymentStatus, RequestChannel, RequestStage } from "./funnel";
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
  channel: RequestChannel;
  chatClientId: string | null;
  sourceNote: string | null;
  attribution: Attribution | null;
  stage: RequestStage;
  stageChangedAt: Date | null;
  lossReasonId: number | null;
  lossComment: string | null;
  assignee: string | null;
  dealAmount: string | null;
  currency: string;
  contractDate: string | null;
  paymentStatus: PaymentStatus;
  paidAmount: string | null;
  paidAt: string | null;
  /** Направление плана продаж (sales_directions.id); null — не классифицирована. */
  directionId: string | null;
};

export type RequestListItem = Pick<RequestRecord, "id" | "createdAt" | "name" | "phone" | "email" | "serviceTitle" | "status" | "channel" | "stage" | "assignee">;

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
  channel: RequestChannel;
  chat_client_id: string | null;
  source_note: string | null;
  attribution: Attribution | null;
  stage: RequestStage;
  stage_changed_at: Date | null;
  loss_reason_id: number | null;
  loss_comment: string | null;
  assignee: string | null;
  deal_amount: string | null;
  currency: string;
  contract_date: string | null;
  payment_status: PaymentStatus;
  paid_amount: string | null;
  paid_at: string | null;
  direction_id: string | null;
};

const FULL_COLUMNS = `id, created_at, updated_at, name, phone, email, service, service_title, message, status, notes, source_page, context, consent_revision, channel, chat_client_id,
  source_note, attribution, stage, stage_changed_at, loss_reason_id, loss_comment, assignee, deal_amount, currency,
  to_char(contract_date, 'YYYY-MM-DD') AS contract_date, payment_status, paid_amount, to_char(paid_at, 'YYYY-MM-DD') AS paid_at, direction_id`;

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
    chatClientId: row.chat_client_id,
    sourceNote: row.source_note,
    attribution: row.attribution,
    stage: row.stage,
    stageChangedAt: row.stage_changed_at,
    lossReasonId: row.loss_reason_id,
    lossComment: row.loss_comment,
    assignee: row.assignee,
    dealAmount: row.deal_amount,
    currency: row.currency,
    contractDate: row.contract_date,
    paymentStatus: row.payment_status,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at,
    directionId: row.direction_id,
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
  /** Канал: форма на сайте (по умолчанию) или чат-бот мессенджера. */
  channel?: RequestChannel;
  chatClientId?: string | null;
  attribution?: Attribution | null;
  sourceNote?: string | null;
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
    // Направление плана продаж — по услуге, которую выбрал клиент (sales_directions.service_slugs); без услуги — не задано.
    `INSERT INTO requests (submission_key, name, phone, phone_digits, email, service, service_title, message, source_page, consent_revision, context, channel, chat_client_id, attribution, source_note, stage_changed_at, direction_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(),
       (SELECT d.id FROM sales_directions d WHERE $6 <> '' AND $6 = ANY (d.service_slugs) ORDER BY d.sort LIMIT 1))
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
      input.chatClientId ?? null,
      input.attribution ? JSON.stringify(input.attribution) : null,
      input.sourceNote ?? null,
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

/** Заявки клиента из мессенджера — для карточки клиента. */
export async function listRequestsByChatClient(chatClientId: string): Promise<RequestListItem[]> {
  if (!isUuid(chatClientId)) return [];
  const rows = await query<Row>(
    `SELECT ${FULL_COLUMNS} FROM requests WHERE chat_client_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [chatClientId],
  );
  return rows.map(toRecord);
}

// --- Работа с заявкой: статус, воронка, сделка, оплата, источник (с историей изменений) ---

export type RequestWorkChanges = {
  status: RequestStatus;
  notes: string;
  stage: RequestStage;
  lossReasonId: number | null;
  lossComment: string | null;
  assignee: string | null;
  channel: RequestChannel;
  sourceNote: string | null;
  dealAmount: string | null;
  currency: string;
  contractDate: string | null;
  paymentStatus: PaymentStatus;
  paidAmount: string | null;
  paidAt: string | null;
  directionId: string | null;
};

/** Сохраняет изменения и записывает в историю каждое изменённое поле (кроме заметок). */
export async function updateRequestWork(id: string, changes: RequestWorkChanges): Promise<boolean> {
  if (!isUuid(id)) return false;
  return withTransaction(async (db) => {
    const { rows } = await db.query<Row>(`SELECT ${FULL_COLUMNS} FROM requests WHERE id = $1 FOR UPDATE`, [id]);
    const before = rows[0];
    if (!before) return false;
    await db.query(
      `UPDATE requests SET status = $2, notes = $3, stage = $4,
         stage_changed_at = CASE WHEN stage <> $4 THEN now() ELSE stage_changed_at END,
         loss_reason_id = $5, loss_comment = $6, assignee = $7, channel = $8, source_note = $9,
         deal_amount = $10, currency = $11, contract_date = $12, payment_status = $13, paid_amount = $14, paid_at = $15,
         direction_id = $16, updated_at = now()
       WHERE id = $1`,
      [
        id,
        changes.status,
        changes.notes,
        changes.stage,
        changes.stage === "lost" ? changes.lossReasonId : null,
        changes.stage === "lost" ? changes.lossComment : null,
        changes.assignee,
        changes.channel,
        changes.sourceNote,
        changes.dealAmount,
        changes.currency,
        changes.contractDate,
        changes.paymentStatus,
        changes.paidAmount,
        changes.paidAt,
        changes.directionId,
      ],
    );
    const money = (v: string | null) => (v === null ? null : Number(v).toFixed(2));
    await recordChanges(db, id, [
      { field: "status", oldValue: before.status, newValue: changes.status },
      { field: "stage", oldValue: before.stage, newValue: changes.stage },
      { field: "loss_reason", oldValue: before.loss_reason_id?.toString() ?? null, newValue: changes.stage === "lost" ? (changes.lossReasonId?.toString() ?? null) : null },
      { field: "assignee", oldValue: before.assignee, newValue: changes.assignee },
      { field: "channel", oldValue: before.channel, newValue: changes.channel },
      { field: "source_note", oldValue: before.source_note, newValue: changes.sourceNote },
      { field: "deal_amount", oldValue: money(before.deal_amount), newValue: money(changes.dealAmount) },
      { field: "currency", oldValue: before.currency, newValue: changes.currency },
      { field: "contract_date", oldValue: before.contract_date, newValue: changes.contractDate },
      { field: "payment_status", oldValue: before.payment_status, newValue: changes.paymentStatus },
      { field: "paid_amount", oldValue: money(before.paid_amount), newValue: money(changes.paidAmount) },
      { field: "paid_at", oldValue: before.paid_at, newValue: changes.paidAt },
      { field: "direction", oldValue: before.direction_id, newValue: changes.directionId },
    ]);
    return true;
  });
}

export type LossReason = { id: number; title: string; active: boolean; sort: number };

export async function listLossReasons(includeInactive = false): Promise<LossReason[]> {
  return query<LossReason>(`SELECT id, title, active, sort FROM loss_reasons ${includeInactive ? "" : "WHERE active"} ORDER BY sort, id`);
}

export async function saveLossReason(input: { id?: number; title: string; active: boolean; sort: number }): Promise<void> {
  if (input.id) await query("UPDATE loss_reasons SET title = $2, active = $3, sort = $4 WHERE id = $1", [input.id, input.title, input.active, input.sort]);
  else await query("INSERT INTO loss_reasons (title, active, sort) VALUES ($1, $2, $3)", [input.title, input.active, input.sort]);
}

/** Распределение заявок по ответственным — для фильтра аналитики. */
export async function listAssignees(): Promise<string[]> {
  const rows = await query<{ assignee: string }>("SELECT DISTINCT assignee FROM requests WHERE assignee IS NOT NULL AND assignee <> '' ORDER BY assignee LIMIT 100");
  return rows.map((r) => r.assignee);
}
