import "server-only";
import { describeDbError, query, withClient } from "@/lib/db";
import { deliverPendingNotifications } from "@/lib/notifications/delivery";
import { notify } from "@/lib/notifications/service";
import { markError, markOk } from "@/lib/ops/monitor";
import { getBackupConfig, isScheduledBackupEnabled } from "./config";
import { encryptBackup, runDump } from "./format";
import { s3Delete, s3List, s3Put } from "./s3";

/**
 * Резервные копии базы сайта: согласованный снимок → gzip → AES-256-GCM → внешнее S3-хранилище.
 * Запуски записываются в backup_runs; сбой — запись в журнал «Система» и уведомление администратору.
 * От параллельного запуска (несколько процессов, ручной и плановый) защищает блокировка PostgreSQL.
 */

const BACKUP_LOCK_KEY = 4_812_302;

export type BackupOutcome = { ok: true; runId: string; size: number; rows: number; location: string | null; file?: Buffer } | { ok: false; error: string };

function fileName(date = new Date()): string {
  return `integro-${date.toISOString().replace(/[:T]/g, "-").slice(0, 19)}.bak`;
}

/**
 * Создаёт копию. upload — отправить в хранилище (нужен BACKUP_S3_*), keepFile — вернуть зашифрованный
 * файл (для скачивания из админки).
 */
export async function runBackup(trigger: "schedule" | "manual", options: { upload: boolean; keepFile?: boolean }): Promise<BackupOutcome> {
  const config = getBackupConfig();
  if (!config.key) return { ok: false, error: config.problems[0] ?? "Не задан ключ шифрования." };
  if (options.upload && !config.s3) return { ok: false, error: "Хранилище S3 не настроено (BACKUP_S3_*)." };

  return withClient(async (lockClient) => {
    const { rows: lock } = await lockClient.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [BACKUP_LOCK_KEY]);
    if (!lock[0]?.ok) return { ok: false, error: "Резервная копия уже создаётся." };
    const run = await query<{ id: string }>("INSERT INTO backup_runs (trigger) VALUES ($1) RETURNING id", [trigger]);
    const runId = String(run[0]!.id);
    try {
      const dump = await withClient((client) => runDump(client));
      const file = encryptBackup(dump.data, config.key!);
      let location: string | null = null;
      if (options.upload && config.s3) {
        const key = `${config.prefix}${fileName()}`;
        await s3Put(config.s3, key, file);
        location = `s3://${config.s3.bucket}/${key}`;
        await pruneOldBackups().catch((error) => markError("backup", "backup", `Не удалось удалить старые копии: ${error instanceof Error ? error.message : "ошибка"}`));
      }
      await query("UPDATE backup_runs SET status = 'ok', finished_at = now(), size_bytes = $2, row_count = $3, location = $4 WHERE id = $1", [
        runId,
        file.length,
        dump.rows,
        location ?? (options.keepFile ? "скачана из админки" : null),
      ]);
      await markOk("backup", "backup", { size: file.length, rows: dump.rows, location });
      return { ok: true, runId, size: file.length, rows: dump.rows, location, file: options.keepFile ? file : undefined };
    } catch (error) {
      const message = (error instanceof Error ? error.message : describeDbError(error)).slice(0, 500);
      await query("UPDATE backup_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1", [runId, message]).catch(() => {});
      await markError("backup", "backup", message, { ref: `backup:${runId}`, result: "failed" });
      await notify({ type: "backup_failed", channel: "backup", title: "Сбой резервного копирования", body: message, link: "/admin/sistema", dedupeKey: `backup_failed:${runId}` });
      await deliverPendingNotifications();
      return { ok: false, error: message };
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [BACKUP_LOCK_KEY]).catch(() => {});
    }
  });
}

/** Удаляет из хранилища копии старше BACKUP_RETENTION_DAYS (только файлы integro-*.bak в своей папке). */
export async function pruneOldBackups(): Promise<number> {
  const config = getBackupConfig();
  if (!config.s3) return 0;
  const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
  const objects = await s3List(config.s3, config.prefix);
  let removed = 0;
  for (const object of objects) {
    const name = object.key.slice(config.prefix.length);
    if (!/^integro-[\d-]+\.bak$/.test(name)) continue;
    const time = Date.parse(object.lastModified);
    if (Number.isFinite(time) && time < cutoff) {
      await s3Delete(config.s3, object.key);
      removed += 1;
    }
  }
  return removed;
}

/** Ежедневная копия: в назначенный час по Москве или сразу, если последней успешной копии больше 26 часов. */
export async function runScheduledBackup(now = new Date()): Promise<void> {
  const config = getBackupConfig();
  if (!isScheduledBackupEnabled(config)) return;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).format(now));
  const rows = await query<{ last_ok: Date | null; last_try: Date | null }>(
    "SELECT max(started_at) FILTER (WHERE status = 'ok') AS last_ok, max(started_at) AS last_try FROM backup_runs WHERE trigger = 'schedule'",
  );
  const lastOk = rows[0]?.last_ok?.getTime() ?? 0;
  const lastTry = rows[0]?.last_try?.getTime() ?? 0;
  const hours = (t: number) => (now.getTime() - t) / 3_600_000;
  // Не чаще раза в 20 часов; после сбоя — повтор через час.
  const due = (hour === config.hourMsk && hours(lastOk) > 20) || hours(lastOk) > 26;
  if (!due || hours(lastTry) < 1) return;
  await runBackup("schedule", { upload: true });
}

export type BackupRun = { id: string; startedAt: Date; finishedAt: Date | null; status: string; trigger: string; sizeBytes: number | null; rowCount: number | null; location: string | null; error: string | null };

export async function listBackupRuns(limit = 10): Promise<BackupRun[]> {
  const rows = await query<{ id: string; started_at: Date; finished_at: Date | null; status: string; trigger: string; size_bytes: string | null; row_count: string | null; location: string | null; error: string | null }>(
    `SELECT id, started_at, finished_at, status, trigger, size_bytes, row_count, location, error FROM backup_runs ORDER BY started_at DESC LIMIT ${Math.min(50, limit)}`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    trigger: r.trigger,
    sizeBytes: r.size_bytes === null ? null : Number(r.size_bytes),
    rowCount: r.row_count === null ? null : Number(r.row_count),
    location: r.location,
    error: r.error,
  }));
}
