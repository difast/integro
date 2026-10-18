import type { PoolConfig } from "pg";

// Параметры TLS из строки подключения: обрабатываются здесь, чтобы корневой
// сертификат из DATABASE_CA_CERT применялся и при указанном в адресе sslmode.
const SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslcrl", "uselibpqcompat"];
const TLS_MODES = new Set(["require", "verify-ca", "verify-full"]);

/**
 * Настройки подключения из переменных окружения.
 * TLS включается при DATABASE_SSL=true или sslmode=require / verify-ca / verify-full в адресе;
 * сертификат сервера всегда проверяется (по DATABASE_CA_CERT или системным корневым сертификатам).
 */
export function buildPoolConfig(env: Record<string, string | undefined>): Pick<PoolConfig, "connectionString" | "ssl"> {
  let connectionString = env.DATABASE_URL?.trim() ?? "";
  let sslmode: string | null = null;

  try {
    const url = new URL(connectionString);
    sslmode = url.searchParams.get("sslmode");
    for (const param of SSL_PARAMS) url.searchParams.delete(param);
    connectionString = url.toString();
  } catch {
    // Строка не в формате URL — передаём драйверу как есть.
  }

  const useTls = env.DATABASE_SSL === "true" || (sslmode !== null && TLS_MODES.has(sslmode));
  if (!useTls) return { connectionString, ssl: false };

  // В панели хостинга переводы строк сертификата можно записать как \n.
  const ca = env.DATABASE_CA_CERT?.trim().replace(/\\n/g, "\n") || undefined;
  return { connectionString, ssl: { rejectUnauthorized: true, ca } };
}
