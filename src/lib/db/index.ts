import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { migrations } from "./migrations";

/**
 * Подключение к PostgreSQL.
 *
 * DATABASE_URL — строка подключения (postgresql://user:password@host:5432/db).
 * DATABASE_SSL — "true": TLS с проверкой сертификата (корневой сертификат можно передать
 *   в DATABASE_CA_CERT в формате PEM); не задана — без TLS, для подключения по приватной
 *   сети Timeweb. Параметры строки подключения (sslmode) тоже учитываются драйвером.
 *
 * Пул создаётся лениво при первом запросе. Схема применяется один раз на процесс.
 */

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const globalForDb = globalThis as unknown as {
  integroPool?: Pool;
  integroSchema?: Promise<void>;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseNotConfiguredError();

  const ssl =
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n") || undefined }
      : undefined;

  const pool = new Pool({
    connectionString,
    ssl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    application_name: "integro-site",
  });
  // Ошибка простаивающего соединения не должна завершать процесс.
  pool.on("error", (error) => console.error("[db] idle client error:", describeDbError(error)));
  return pool;
}

function getPool(): Pool {
  globalForDb.integroPool ??= createPool();
  return globalForDb.integroPool;
}

// Произвольное число-ключ для блокировки на время миграций (несколько экземпляров приложения).
const MIGRATION_LOCK_KEY = 4_812_301;

async function applyMigrations(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.id));
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      console.info(`[db] migration applied: ${migration.id}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Применяет недостающие миграции. При ошибке следующий запрос попробует снова. */
export function ensureSchema(): Promise<void> {
  globalForDb.integroSchema ??= applyMigrations().catch((error) => {
    globalForDb.integroSchema = undefined;
    throw error;
  });
  return globalForDb.integroSchema;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Краткое описание ошибки для журнала: код и текст без параметров запроса.
 * Поле detail драйвера может содержать значения полей (персональные данные) — его не выводим.
 */
export function describeDbError(error: unknown): string {
  if (error instanceof DatabaseNotConfiguredError) return error.message;
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    return [typeof code === "string" ? code : null, typeof message === "string" ? message : null]
      .filter(Boolean)
      .join(" ");
  }
  return "unknown error";
}

/** Закрывает пул (для тестов и скриптов). */
export async function closePool(): Promise<void> {
  const pool = globalForDb.integroPool;
  globalForDb.integroPool = undefined;
  globalForDb.integroSchema = undefined;
  await pool?.end();
}
