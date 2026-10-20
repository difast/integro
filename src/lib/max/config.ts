import { getSiteUrl } from "@/lib/site";

/**
 * Настройки чат-бота MAX из переменных окружения.
 *
 * MAX_BOT_TOKEN       — токен бота (выдаёт @MasterBot в MAX). Передаётся только в заголовке Authorization.
 * MAX_WEBHOOK_SECRET  — секрет Webhook: MAX присылает его в заголовке X-Max-Bot-Api-Secret.
 * MAX_WEBHOOK_URL     — публичный HTTPS-адрес обработчика; по умолчанию SITE_URL + /api/max/webhook.
 * MAX_API_CA_CERT     — дополнительный корневой сертификат (PEM) для platform-api2.max.ru, если
 *                       системного набора недостаточно (см. README).
 * MAX_API_BASE_URL    — только для тестов: адрес имитации API. В production не задаётся.
 *
 * Значения токена и секрета нигде не выводятся — только признак «задано / не задано».
 */

export const MAX_API_BASE_URL = "https://platform-api2.max.ru";
export const MAX_WEBHOOK_PATH = "/api/max/webhook";

// MAX принимает секрет из латинских букв, цифр, «-» и «_»; требуем длину не меньше 32 символов.
const SECRET_RE = /^[A-Za-z0-9_-]{32,256}$/;

export type MaxConfigProblem =
  | "token_missing"
  | "secret_missing"
  | "secret_invalid"
  | "webhook_url_missing"
  | "webhook_url_invalid"
  | "api_base_invalid";

export type MaxConfig = {
  token: string | null;
  secret: string | null;
  webhookUrl: string | null;
  apiBaseUrl: string;
  caCert: string | null;
  problems: MaxConfigProblem[];
};

function normalizePem(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const text = raw.replace(/\\n/g, "\n");
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!blocks) return null;
  return blocks
    .map((block) => {
      const body = block
        .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
        .replace(/\s+/g, "");
      const lines = body.match(/.{1,64}/g) ?? [];
      return ["-----BEGIN CERTIFICATE-----", ...lines, "-----END CERTIFICATE-----"].join("\n");
    })
    .join("\n");
}

function isLocalHttp(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export function getMaxConfig(env: NodeJS.ProcessEnv = process.env): MaxConfig {
  const problems: MaxConfigProblem[] = [];
  // Кавычки вокруг значения (частая ошибка при вводе в панели хостинга) отбрасываются.
  const unquote = (value: string | undefined) => value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || null;
  const token = unquote(env.MAX_BOT_TOKEN);
  const secret = unquote(env.MAX_WEBHOOK_SECRET);
  if (!token) problems.push("token_missing");
  if (!secret) problems.push("secret_missing");
  else if (!SECRET_RE.test(secret)) problems.push("secret_invalid");

  const site = env.SITE_URL?.trim() ? env.SITE_URL.trim().replace(/\/+$/, "") : getSiteUrl();
  const rawUrl = env.MAX_WEBHOOK_URL?.trim() || (site ? `${site}${MAX_WEBHOOK_PATH}` : "");
  let webhookUrl: string | null = null;
  if (!rawUrl) problems.push("webhook_url_missing");
  else {
    try {
      const url = new URL(rawUrl);
      if (url.protocol === "https:" && !url.username && !url.password) webhookUrl = url.href;
      else problems.push("webhook_url_invalid");
    } catch {
      problems.push("webhook_url_invalid");
    }
  }

  let apiBaseUrl = MAX_API_BASE_URL;
  const override = env.MAX_API_BASE_URL?.trim();
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol === "https:" || isLocalHttp(url)) apiBaseUrl = url.origin;
      else problems.push("api_base_invalid");
    } catch {
      problems.push("api_base_invalid");
    }
  }

  return { token, secret, webhookUrl, apiBaseUrl, caCert: normalizePem(env.MAX_API_CA_CERT), problems };
}

/** Бот может принимать события: заданы токен и корректный секрет Webhook. */
export function isMaxEnabled(config: MaxConfig = getMaxConfig()): boolean {
  return !config.problems.some((p) => p === "token_missing" || p === "secret_missing" || p === "secret_invalid" || p === "api_base_invalid");
}

export const maxProblemText: Record<MaxConfigProblem, string> = {
  token_missing: "Не задана переменная MAX_BOT_TOKEN (токен бота из @MasterBot).",
  secret_missing: "Не задана переменная MAX_WEBHOOK_SECRET (секрет для проверки входящих событий).",
  secret_invalid:
    "MAX_WEBHOOK_SECRET должен состоять из 32–256 латинских букв, цифр, «-» или «_» (например, результат команды openssl rand -hex 32).",
  webhook_url_missing: "Не удалось определить адрес Webhook: задайте MAX_WEBHOOK_URL или SITE_URL.",
  webhook_url_invalid: "MAX_WEBHOOK_URL должен быть публичным адресом https://… без логина и пароля.",
  api_base_invalid: "MAX_API_BASE_URL задан неверно (эта переменная нужна только для тестов — удалите её).",
};
