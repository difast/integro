import type { PoolConfig } from "pg";

import type { ConnectionOptions } from "node:tls";

export type DbConnectionConfig = Pick<
  PoolConfig,
  "connectionString" | "host" | "port" | "database" | "user" | "password" | "ssl"
>;

type ParsedUrl = {
  user: string;
  password: string;
  host: string;
  port: number | undefined;
  database: string;
  params: URLSearchParams;
};

/** Раскодирует %XX; если последовательность некорректна — значение остаётся как есть. */
function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Разбирает postgresql://пользователь:пароль@хост:порт/база?параметры.
 *
 * Пароль может быть как закодирован (%40, %3F), так и вставлен «как есть» со
 * спецсимволами @ # ? / : — панель Timeweb раскодирует значения переменных, поэтому
 * стандартный разбор URL здесь не подходит. Хост не может содержать «@», поэтому
 * учётные данные отделяются по последнему «@».
 */
export function parseDatabaseUrl(raw: string): ParsedUrl | null {
  const match = /^postgres(?:ql)?:\/\//i.exec(raw);
  if (!match) return null;
  const rest = raw.slice(match[0].length);

  const at = rest.lastIndexOf("@");
  const credentials = at >= 0 ? rest.slice(0, at) : "";
  const location = at >= 0 ? rest.slice(at + 1) : rest;

  const colon = credentials.indexOf(":");
  const user = decode(colon >= 0 ? credentials.slice(0, colon) : credentials);
  const password = colon >= 0 ? decode(credentials.slice(colon + 1)) : "";

  const queryStart = location.indexOf("?");
  const params = new URLSearchParams(queryStart >= 0 ? location.slice(queryStart + 1) : "");
  const hostAndPath = queryStart >= 0 ? location.slice(0, queryStart) : location;
  const slash = hostAndPath.indexOf("/");
  const hostPort = slash >= 0 ? hostAndPath.slice(0, slash) : hostAndPath;
  const database = decode(slash >= 0 ? hostAndPath.slice(slash + 1) : "");

  // [IPv6]:порт или хост:порт
  const hostMatch = /^(\[[^\]]+\]|[^:]*)(?::(\d+))?$/.exec(hostPort);
  if (!hostMatch || !hostMatch[1]) return null;
  const host = hostMatch[1].replace(/^\[|\]$/g, "");
  const port = hostMatch[2] ? Number(hostMatch[2]) : undefined;

  return { user, password, host, port, database, params };
}

/**
 * Настройки TLS по sslmode (как в libpq) и DATABASE_SSL=true:
 *   require     — шифрование; сертификат проверяется, только если задан DATABASE_CA_CERT;
 *   verify-ca   — проверка цепочки сертификата без сверки имени хоста (подходит для IP-адреса);
 *   verify-full — проверка цепочки и имени хоста (DATABASE_SSL=true означает то же самое);
 *   иначе       — без TLS.
 */
function tlsOptions(sslmode: string | null, env: Record<string, string | undefined>): ConnectionOptions | false {
  const ca = normalizePem(env.DATABASE_CA_CERT);
  const mode = env.DATABASE_SSL === "true" && !sslmode ? "verify-full" : sslmode;
  switch (mode) {
    case "verify-full":
      return { rejectUnauthorized: true, ca };
    case "verify-ca":
      return { rejectUnauthorized: true, ca, checkServerIdentity: () => undefined };
    case "require":
      return ca ? { rejectUnauthorized: true, ca, checkServerIdentity: () => undefined } : { rejectUnauthorized: false };
    default:
      return false;
  }
}

/** Настройки подключения из переменных окружения DATABASE_URL, DATABASE_SSL, DATABASE_CA_CERT. */
export function buildPoolConfig(env: Record<string, string | undefined>): DbConnectionConfig {
  const raw = env.DATABASE_URL?.trim() ?? "";
  const parsed = parseDatabaseUrl(raw);
  if (!parsed) {
    // Не URL (например, строка вида "host=... user=...") — передаём драйверу как есть.
    return { connectionString: raw, ssl: tlsOptions(null, env) };
  }
  return {
    host: parsed.host,
    port: parsed.port ?? 5432,
    database: parsed.database || undefined,
    user: parsed.user || undefined,
    password: parsed.password,
    ssl: tlsOptions(parsed.params.get("sslmode"), env),
  };
}

/** Описание подключения для журнала — без пароля. */
export function describeConnection(config: DbConnectionConfig): string {
  if (!config.host) return "connection string (non-URL format)";
  return `${config.user ?? "?"}@${config.host}:${config.port}/${config.database ?? ""}`;
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
