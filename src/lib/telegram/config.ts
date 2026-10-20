import { getSiteUrl } from "@/lib/site";

/**
 * Настройки Telegram-бота из переменных окружения.
 *
 * TELEGRAM_BOT_TOKEN      — токен бота от @BotFather. В Telegram Bot API токен — часть адреса запроса
 *                           (https://api.telegram.org/bot<токен>/метод), поэтому адреса запросов
 *                           никогда не пишутся в журнал и не попадают в тексты ошибок.
 * TELEGRAM_WEBHOOK_SECRET — секрет Webhook: Telegram присылает его в заголовке X-Telegram-Bot-Api-Secret-Token.
 * TELEGRAM_WEBHOOK_URL    — публичный HTTPS-адрес обработчика; по умолчанию SITE_URL + /api/telegram/webhook.
 * TELEGRAM_BOT_USERNAME   — username бота без «@» (для ссылки в админке), необязательно.
 * TELEGRAM_API_BASE_URL   — только для тестов: адрес имитации Bot API. В production не задаётся.
 */

export const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";

// Bot API: 1–256 символов A-Z, a-z, 0-9, «_» и «-». Требуем не меньше 32 символов.
const SECRET_RE = /^[A-Za-z0-9_-]{32,256}$/;
// Формат токена BotFather: <числовой id>:<строка>.
const TOKEN_RE = /^\d{5,20}:[A-Za-z0-9_-]{20,100}$/;
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

export type TelegramConfigProblem =
  | "token_missing"
  | "token_invalid"
  | "secret_missing"
  | "secret_invalid"
  | "webhook_url_missing"
  | "webhook_url_invalid"
  | "username_invalid"
  | "api_base_invalid";

export type TelegramConfig = {
  token: string | null;
  secret: string | null;
  webhookUrl: string | null;
  username: string | null;
  apiBaseUrl: string;
  problems: TelegramConfigProblem[];
};

function isLocalHttp(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

// Кавычки вокруг значения (частая ошибка при вводе в панели хостинга) отбрасываются.
const unquote = (value: string | undefined) => value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || null;

export function getTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig {
  const problems: TelegramConfigProblem[] = [];
  const token = unquote(env.TELEGRAM_BOT_TOKEN);
  const secret = unquote(env.TELEGRAM_WEBHOOK_SECRET);
  if (!token) problems.push("token_missing");
  else if (!TOKEN_RE.test(token)) problems.push("token_invalid");
  if (!secret) problems.push("secret_missing");
  else if (!SECRET_RE.test(secret)) problems.push("secret_invalid");

  const rawUsername = unquote(env.TELEGRAM_BOT_USERNAME)?.replace(/^@/, "") ?? null;
  let username: string | null = null;
  if (rawUsername) {
    if (USERNAME_RE.test(rawUsername)) username = rawUsername;
    else problems.push("username_invalid");
  }

  const site = env.SITE_URL?.trim() ? env.SITE_URL.trim().replace(/\/+$/, "") : getSiteUrl();
  const rawUrl = env.TELEGRAM_WEBHOOK_URL?.trim() || (site ? `${site}${TELEGRAM_WEBHOOK_PATH}` : "");
  let webhookUrl: string | null = null;
  if (!rawUrl) problems.push("webhook_url_missing");
  else {
    try {
      const url = new URL(rawUrl);
      const port = url.port ? Number(url.port) : 443;
      // Telegram доставляет Webhook только по HTTPS на порты 443, 80, 88 и 8443.
      if (url.protocol === "https:" && !url.username && !url.password && [443, 80, 88, 8443].includes(port)) webhookUrl = url.href;
      else problems.push("webhook_url_invalid");
    } catch {
      problems.push("webhook_url_invalid");
    }
  }

  let apiBaseUrl = TELEGRAM_API_BASE_URL;
  const override = env.TELEGRAM_API_BASE_URL?.trim();
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol === "https:" || isLocalHttp(url)) apiBaseUrl = url.origin;
      else problems.push("api_base_invalid");
    } catch {
      problems.push("api_base_invalid");
    }
  }

  return { token, secret, webhookUrl, username, apiBaseUrl, problems };
}

/** Бот может принимать события: заданы корректные токен и секрет Webhook. */
export function isTelegramEnabled(config: TelegramConfig = getTelegramConfig()): boolean {
  return !config.problems.some((p) => p === "token_missing" || p === "token_invalid" || p === "secret_missing" || p === "secret_invalid" || p === "api_base_invalid");
}

export const telegramProblemText: Record<TelegramConfigProblem, string> = {
  token_missing: "Не задана переменная TELEGRAM_BOT_TOKEN (токен бота от @BotFather).",
  token_invalid: "TELEGRAM_BOT_TOKEN задан в неверном формате: ожидается «123456789:AAE…» из сообщения @BotFather.",
  secret_missing: "Не задана переменная TELEGRAM_WEBHOOK_SECRET (секрет для проверки входящих событий).",
  secret_invalid:
    "TELEGRAM_WEBHOOK_SECRET должен состоять из 32–256 латинских букв, цифр, «-» или «_» (например, результат команды openssl rand -hex 32).",
  webhook_url_missing: "Не удалось определить адрес Webhook: задайте TELEGRAM_WEBHOOK_URL или SITE_URL.",
  webhook_url_invalid: "TELEGRAM_WEBHOOK_URL должен быть адресом https://… без логина и пароля, на порту 443, 80, 88 или 8443.",
  username_invalid: "TELEGRAM_BOT_USERNAME задан неверно: укажите username бота без «@», например integro_bot.",
  api_base_invalid: "TELEGRAM_API_BASE_URL задан неверно (эта переменная нужна только для тестов — удалите её).",
};
