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

  return { connectionString, ssl: { rejectUnauthorized: true, ca: normalizePem(env.DATABASE_CA_CERT) } };
}

const PEM_BLOCK = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;

/**
 * Приводит сертификат к стандартному виду PEM. Однострочные поля панели хостинга
 * превращают переводы строк в пробелы или «\n» — содержимое пересобирается
 * по 64 символа в строке.
 */
export function normalizePem(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const blocks = [...value.matchAll(PEM_BLOCK)].map((match) => {
    const body = (match[1] ?? "").replace(/\\n|\s/g, "");
    const lines = body.match(/.{1,64}/g) ?? [];
    return ["-----BEGIN CERTIFICATE-----", ...lines, "-----END CERTIFICATE-----"].join("\n");
  });
  return blocks.length > 0 ? `${blocks.join("\n")}\n` : undefined;
}
