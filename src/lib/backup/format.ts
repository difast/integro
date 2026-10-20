import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ClientBase } from "pg";
import { migrations } from "@/lib/db/migrations";

/**
 * Формат резервной копии базы сайта (без зависимостей от Next.js — используется и сервером, и скриптом
 * scripts/db-backup.ts).
 *
 * Содержимое: gzip(NDJSON) — первая строка {"format":"integro-backup","version":1,…}, далее для каждой
 * таблицы {"table":…} и её строки (row_to_json). Выгрузка — в одной транзакции REPEATABLE READ READ ONLY,
 * то есть согласованный снимок работающей базы, а не копирование файлов.
 * Шифрование: AES-256-GCM, ключ BACKUP_ENCRYPTION_KEY (32 байта). Файл: "INTEGROBK1" + IV(12) + шифртекст + тег(16).
 */

/** Таблицы в порядке восстановления (сначала те, на которые ссылаются другие). */
export const BACKUP_TABLES = [
  "loss_reasons",
  "chat_clients",
  "requests",
  "request_history",
  "chat_events",
  "chat_messages",
  "chat_notes",
  "messenger_clicks",
  "app_settings",
  "notifications",
  "notification_recipients",
  "push_subscriptions",
  "notification_deliveries",
  "integration_status",
  "system_events",
  "backup_runs",
] as const;

/** Не копируются: сессии и попытки входа (восстанавливать их небезопасно), одноразовые коды, служебная таблица миграций. */
export const EXCLUDED_TABLES = ["admin_sessions", "admin_login_attempts", "admin_link_codes", "schema_migrations"] as const;

const MAGIC = Buffer.from("INTEGROBK1");

export function parseBackupKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 ? decoded : null;
}

export function encryptBackup(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

export function decryptBackup(file: Buffer, key: Buffer): Buffer {
  if (file.length < MAGIC.length + 28 || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Это не файл резервной копии сайта.");
  const iv = file.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = file.subarray(file.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(file.subarray(MAGIC.length + 12, file.length - 16)), decipher.final()]);
  } catch {
    throw new Error("Не удалось расшифровать копию: неверный ключ BACKUP_ENCRYPTION_KEY или файл повреждён.");
  }
}

export type DumpResult = { data: Buffer; rows: number; tables: number };

/** Выгрузка всех таблиц. Клиент должен быть внутри транзакции REPEATABLE READ (см. runDump). */
export async function dumpTables(client: ClientBase): Promise<DumpResult> {
  const { rows: applied } = await client.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");
  const lines: string[] = [
    JSON.stringify({ format: "integro-backup", version: 1, createdAt: new Date().toISOString(), migrations: applied.map((r) => r.id), tables: BACKUP_TABLES }),
  ];
  let total = 0;
  for (const table of BACKUP_TABLES) {
    lines.push(JSON.stringify({ table }));
    await client.query(`DECLARE dump_cursor NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS j FROM ${table} t`);
    for (;;) {
      const { rows } = await client.query<{ j: string }>("FETCH 1000 FROM dump_cursor");
      if (rows.length === 0) break;
      for (const row of rows) lines.push(row.j);
      total += rows.length;
    }
    await client.query("CLOSE dump_cursor");
  }
  return { data: gzipSync(Buffer.from(lines.join("\n"), "utf8")), rows: total, tables: BACKUP_TABLES.length };
}

/** Согласованная выгрузка на отдельном соединении. */
export async function runDump(client: ClientBase): Promise<DumpResult> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const result = await dumpTables(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

const MIGRATION_LOCK_KEY = 4_812_301;

/** Применяет миграции сайта к базе (для восстановления в пустую базу). */
export async function applyMigrations(client: ClientBase): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.id));
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

export type RestoreResult = { rows: number; tables: number; createdAt: string };

/**
 * Восстановление: применяет миграции, затем в одной транзакции очищает таблицы копии и загружает строки.
 * При любой ошибке транзакция откатывается — база остаётся в прежнем состоянии.
 */
export async function restoreTables(client: ClientBase, gz: Buffer): Promise<RestoreResult> {
  const lines = gunzipSync(gz).toString("utf8").split("\n");
  const header = JSON.parse(lines[0] ?? "{}") as { format?: string; version?: number; createdAt?: string; migrations?: string[] };
  if (header.format !== "integro-backup" || header.version !== 1) throw new Error("Неизвестный формат резервной копии.");
  const known = new Set(migrations.map((m) => m.id));
  const unknown = (header.migrations ?? []).filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`Копия создана более новой версией сайта (миграции ${unknown.join(", ")}). Обновите код перед восстановлением.`);

  await applyMigrations(client);
  await client.query("BEGIN");
  try {
    await client.query(`TRUNCATE ${BACKUP_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
    let table: string | null = null;
    let batch: string[] = [];
    let total = 0;
    const flush = async () => {
      if (!table || batch.length === 0) return;
      await client.query(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table}, $1::json)`, [`[${batch.join(",")}]`]);
      total += batch.length;
      batch = [];
    };
    for (const line of lines.slice(1)) {
      if (!line) continue;
      if (line.startsWith('{"table":')) {
        await flush();
        const name = (JSON.parse(line) as { table: string }).table;
        if (!(BACKUP_TABLES as readonly string[]).includes(name)) throw new Error(`Неизвестная таблица в копии: ${name}`);
        table = name;
        continue;
      }
      batch.push(line);
      if (batch.length >= 500) await flush();
    }
    await flush();
    // Счётчики идентификаторов — после максимальных восстановленных значений.
    for (const name of BACKUP_TABLES) {
      const { rows: idColumn } = await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'id'",
        [name],
      );
      if (idColumn.length === 0) continue;
      const { rows } = await client.query<{ seq: string | null }>("SELECT pg_get_serial_sequence($1, 'id') AS seq", [name]);
      const seq = rows[0]?.seq;
      if (seq) await client.query(`SELECT setval($1, coalesce((SELECT max(id) FROM ${name}), 1), (SELECT max(id) IS NOT NULL FROM ${name}))`, [seq]);
    }
    await client.query("COMMIT");
    return { rows: total, tables: BACKUP_TABLES.length, createdAt: header.createdAt ?? "" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
