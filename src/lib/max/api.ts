import "server-only";
import http from "node:http";
import https from "node:https";
import { rootCertificates } from "node:tls";
import { ChannelApiError, withSafeRetry } from "@/lib/chat/errors";
import { getMaxConfig, type MaxConfig } from "./config";
import type { MaxButton } from "./types";

/**
 * Клиент MAX Bot API (https://platform-api2.max.ru). Методы и поля — по официальному
 * клиенту MAX (github.com/max-messenger/max-bot-api-client-ts) и документации dev.max.ru.
 *
 * Токен передаётся только в заголовке Authorization. В тексты ошибок и журналы не попадают
 * ни токен, ни адрес запроса с параметрами, ни тело запроса.
 */

/** Ошибка MAX API (виды — в src/lib/chat/errors.ts). */
export class MaxApiError extends ChannelApiError {
  constructor(...args: ConstructorParameters<typeof ChannelApiError>) {
    super(...args);
    this.name = "MaxApiError";
  }

  get summary(): string {
    if (this.kind === "http") return `MAX API ${this.status}${this.code ? ` ${this.code}` : ""}: ${this.message}`.slice(0, 300);
    return this.message.slice(0, 300);
  }
}

const TLS_ERROR_RE = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)/i;
const CONNECT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;

type CallOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export type MaxTransport = (config: MaxConfig, options: CallOptions) => Promise<unknown>;

function describeNetworkError(error: NodeJS.ErrnoException, connected: boolean): MaxApiError {
  const code = error.code ?? "";
  if (!connected && (CONNECT_CODES.has(code) || TLS_ERROR_RE.test(code) || TLS_ERROR_RE.test(error.message))) {
    const tls = TLS_ERROR_RE.test(code) || TLS_ERROR_RE.test(error.message);
    return new MaxApiError(
      "connect",
      tls
        ? `TLS: сертификат MAX API не прошёл проверку (${code || "TLS error"}). См. MAX_API_CA_CERT в README.`
        : `Нет соединения с MAX API (${code}).`,
      null,
      code || null,
    );
  }
  if (!connected) return new MaxApiError("connect", `Нет соединения с MAX API (${code || "network error"}).`, null, code || null);
  return new MaxApiError("unknown", `Ответ MAX API не получен (${code || "connection lost"}); результат неизвестен.`, null, code || null);
}

/** Транспорт на node:https: поддерживает дополнительный корневой сертификат и тайм-аут. */
const nodeTransport: MaxTransport = (config, options) =>
  new Promise((resolve, reject) => {
    if (!config.token) {
      reject(new MaxApiError("config", "Не задан MAX_BOT_TOKEN."));
      return;
    }
    const url = new URL(options.path.replace(/^\//, ""), `${config.apiBaseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const body = options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body));
    const headers: Record<string, string> = { Authorization: config.token, Accept: "application/json" };
    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(body.length);
    }

    const isHttps = url.protocol === "https:";
    const requestOptions: https.RequestOptions = { method: options.method, headers, timeout: TIMEOUT_MS };
    if (isHttps && config.caCert) requestOptions.ca = [...rootCertificates, config.caCert];

    let connected = false;
    let settled = false;
    const fail = (error: MaxApiError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const req = (isHttps ? https : http).request(url, requestOptions, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy();
          fail(new MaxApiError("unknown", "Слишком большой ответ MAX API."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("error", (error) => fail(describeNetworkError(error, true)));
      res.on("end", () => {
        if (settled) return;
        const status = res.statusCode ?? 0;
        const text = Buffer.concat(chunks).toString("utf8");
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        if (status >= 200 && status < 300) {
          settled = true;
          resolve(data);
          return;
        }
        const info = (data && typeof data === "object" ? data : {}) as { code?: unknown; message?: unknown };
        const retryAfter = Number(res.headers["retry-after"]);
        fail(
          new MaxApiError(
            "http",
            status === 401
              ? "токен бота не принят (проверьте MAX_BOT_TOKEN)"
              : typeof info.message === "string"
                ? info.message
                : `HTTP ${status}`,
            status,
            typeof info.code === "string" ? info.code : null,
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
          ),
        );
      });
    });

    req.on("socket", (socket) => {
      socket.once(isHttps ? "secureConnect" : "connect", () => {
        connected = true;
      });
    });
    req.on("timeout", () => {
      req.destroy();
      fail(
        connected
          ? new MaxApiError("unknown", "MAX API не ответил за 10 секунд; результат неизвестен.")
          : new MaxApiError("connect", "Не удалось подключиться к MAX API за 10 секунд."),
      );
    });
    req.on("error", (error: NodeJS.ErrnoException) => fail(describeNetworkError(error, connected)));
    if (body) req.write(body);
    req.end();
  });

let transport: MaxTransport = nodeTransport;

/** Подмена транспорта в тестах. */
export function setMaxTransport(next: MaxTransport | null): void {
  transport = next ?? nodeTransport;
}

async function call<T>(options: CallOptions, config = getMaxConfig()): Promise<T> {
  return (await transport(config, options)) as T;
}

export const maxUpdateTypes = ["bot_started", "bot_stopped", "message_created", "message_callback", "dialog_removed"] as const;

export type MaxOutgoingBody = {
  text: string;
  attachments?: { type: "inline_keyboard"; payload: { buttons: MaxButton[][] } }[];
  notify?: boolean;
};

export type MaxSentMessage = { message?: { body?: { mid?: string }; timestamp?: number } };

export const maxApi = {
  /** GET /me — сведения о боте; проверка токена. */
  getMe: () => call<{ user_id: number; first_name?: string; name?: string; username?: string | null }>({ method: "GET", path: "me" }),

  /** GET /subscriptions — текущие Webhook-подписки. */
  getSubscriptions: () =>
    call<{ subscriptions?: { url: string; time: number; update_types?: string[] | null }[] }>({ method: "GET", path: "subscriptions" }),

  /** POST /subscriptions — подписка на события по Webhook с секретом. */
  subscribe: (url: string, secret: string, updateTypes: readonly string[] = maxUpdateTypes) =>
    call<{ success: boolean; message?: string }>({
      method: "POST",
      path: "subscriptions",
      body: { url, secret, update_types: updateTypes },
    }),

  /** DELETE /subscriptions?url= — отписка. */
  unsubscribe: (url: string) => call<{ success: boolean; message?: string }>({ method: "DELETE", path: "subscriptions", query: { url } }),

  /** POST /messages?user_id= — сообщение пользователю в диалог с ботом. */
  sendToUser: (userId: number, body: MaxOutgoingBody) =>
    withSafeRetry(() => call<MaxSentMessage>({ method: "POST", path: "messages", query: { user_id: userId }, body })),

  /** POST /answers?callback_id= — ответ на нажатие кнопки (изменение сообщения или уведомление). */
  answerCallback: (callbackId: string, body: { message?: MaxOutgoingBody; notification?: string }) =>
    withSafeRetry(() => call<{ success: boolean; message?: string }>({ method: "POST", path: "answers", query: { callback_id: callbackId }, body })),
};
