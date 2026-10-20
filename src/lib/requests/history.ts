import "server-only";
import type { PoolClient } from "pg";
import { describeDbError, query } from "@/lib/db";

/** История изменений заявки (request_history): статус, этап, источник, ответственный, сумма, оплата. */

export type HistoryActor = "admin" | "system" | "site" | "bot";
type Executor = Pick<PoolClient, "query">;

export async function recordRequestCreated(requestId: string, actor: HistoryActor, db?: Executor): Promise<void> {
  const sql = "INSERT INTO request_history (request_id, field, new_value, actor) VALUES ($1, 'created', $2, $3)";
  try {
    if (db) await db.query(sql, [requestId, actor, actor]);
    else await query(sql, [requestId, actor, actor]);
  } catch (error) {
    if (db) throw error;
    console.error("[requests] failed to record history:", describeDbError(error));
  }
}

export async function recordChanges(
  db: Executor,
  requestId: string,
  changes: { field: string; oldValue: string | null; newValue: string | null }[],
  actor: HistoryActor = "admin",
): Promise<void> {
  for (const change of changes) {
    if ((change.oldValue ?? "") === (change.newValue ?? "")) continue;
    await db.query("INSERT INTO request_history (request_id, field, old_value, new_value, actor) VALUES ($1, $2, $3, $4, $5)", [
      requestId,
      change.field,
      change.oldValue?.slice(0, 300) ?? null,
      change.newValue?.slice(0, 300) ?? null,
      actor,
    ]);
  }
}

export type HistoryRecord = { id: string; field: string; oldValue: string | null; newValue: string | null; actor: HistoryActor; changedAt: Date };

export async function listRequestHistory(requestId: string): Promise<HistoryRecord[]> {
  const rows = await query<{ id: string; field: string; old_value: string | null; new_value: string | null; actor: HistoryActor; changed_at: Date }>(
    "SELECT id, field, old_value, new_value, actor, changed_at FROM request_history WHERE request_id = $1 ORDER BY changed_at, id LIMIT 200",
    [requestId],
  );
  return rows.map((r) => ({ id: String(r.id), field: r.field, oldValue: r.old_value, newValue: r.new_value, actor: r.actor, changedAt: r.changed_at }));
}
