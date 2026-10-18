import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { buildPoolConfig } from "./config";
import { migrations } from "./migrations";

/**
 * Подключение к PostgreSQL.
 *
 * DATABASE_URL — строка подключения (postgresql://user:password@host:5432/db?sslmode=verify-full).
 * TLS включается параметром sslmode в адресе или DATABASE_SSL=true; корневой сертификат
 * провайдера передаётся в DATABASE_CA_CERT (PEM). Подробности — src/lib/db/config.ts.
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
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();

  const config = buildPoolConfig(process.env);
  // Диагностика без секретов: включён ли TLS и распознан ли сертификат из DATABASE_CA_CERT.
  if (config.ssl) {
    const ca = typeof config.ssl === "object" ? config.ssl.ca : undefined;
    const source = ca
      ? `DATABASE_CA_CERT (${String(ca).split("BEGIN CERTIFICATE").length - 1} cert)`
      : process.env.DATABASE_CA_CERT?.trim()
        ? "DATABASE_CA_CERT is set but no PEM certificate found in it; using system CAs"
        : "system CAs";
    console.info(`[db] TLS on, certificate check: ${source}`);
  } else {
    console.info("[db] TLS off");
  }

  const pool = new Pool({
    ...config,
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
