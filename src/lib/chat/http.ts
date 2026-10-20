import "server-only";
import http from "node:http";
import https from "node:https";
import { ChannelApiError } from "./errors";

/**
 * HTTP-запрос с JSON-телом и тайм-аутом для API мессенджеров. Различает ошибки, при которых
 * запрос точно не дошёл (connect), и ошибки с неизвестным результатом (unknown).
 * Адрес запроса в тексты ошибок не попадает (в Telegram в нём содержится токен).
 */

const TLS_ERROR_RE = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)/i;
const MAX_RESPONSE_BYTES = 1_000_000;

export type JsonResponse = { status: number; data: unknown; retryAfterHeader: string | null };

function networkError(service: string, error: NodeJS.ErrnoException, connected: boolean): ChannelApiError {
  const code = error.code ?? "";
  if (!connected) {
    const tls = TLS_ERROR_RE.test(code) || TLS_ERROR_RE.test(error.message);
    return new ChannelApiError(
      "connect",
      tls ? `TLS: сертификат ${service} не прошёл проверку (${code || "TLS error"}).` : `Нет соединения с ${service} (${code || "network error"}).`,
      null,
      code || null,
    );
  }
  return new ChannelApiError("unknown", `Ответ ${service} не получен (${code || "connection lost"}); результат неизвестен.`, null, code || null);
}

export function postJson(url: URL, body: unknown, options: { service: string; timeoutMs?: number; ca?: string[] } ): Promise<JsonResponse> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body ?? {}));
    const isHttps = url.protocol === "https:";
    const requestOptions: https.RequestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(payload.length), Accept: "application/json" },
      timeout: timeoutMs,
    };
    if (isHttps && options.ca) requestOptions.ca = options.ca;

    let connected = false;
    let settled = false;
    const fail = (error: ChannelApiError) => {
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
          fail(new ChannelApiError("unknown", `Слишком большой ответ ${options.service}.`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("error", (error) => fail(networkError(options.service, error, true)));
      res.on("end", () => {
        if (settled) return;
        settled = true;
        let data: unknown = null;
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        const retry = res.headers["retry-after"];
        resolve({ status: res.statusCode ?? 0, data, retryAfterHeader: typeof retry === "string" ? retry : null });
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
          ? new ChannelApiError("unknown", `${options.service} не ответил за ${timeoutMs / 1000} секунд; результат неизвестен.`)
          : new ChannelApiError("connect", `Не удалось подключиться к ${options.service} за ${timeoutMs / 1000} секунд.`),
      );
    });
    req.on("error", (error: NodeJS.ErrnoException) => fail(networkError(options.service, error, connected)));
    req.write(payload);
    req.end();
  });
}
