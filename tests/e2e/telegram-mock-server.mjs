// Имитация Telegram Bot API для сквозных тестов: POST /bot<токен>/<метод>, ответы { ok, result }.
// Запоминает запросы (GET /__requests). Неверный токен — 401, как у настоящего API.
import http from "node:http";

const port = Number(process.argv[2] ?? 3204);
const token = process.env.TG_MOCK_TOKEN ?? "123456789:AAE_e2e-telegram-token-0123456789";
let requests = [];
let messageId = 100;
let webhook = { url: "", allowed_updates: [] };

const send = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/__health") return send(res, 200, { ok: true });
      if (url.pathname === "/__requests") return send(res, 200, requests);
      if (url.pathname === "/__reset") {
        requests = [];
        return send(res, 200, { ok: true });
      }
      const match = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname);
      if (!match) return send(res, 404, { ok: false, error_code: 404, description: "Not Found" });
      const [, gotToken, method] = match;
      const params = body ? JSON.parse(body) : {};
      requests.push({ method, tokenOk: gotToken === token, params });
      if (gotToken !== token) return send(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
      switch (method) {
        case "getMe":
          return send(res, 200, { ok: true, result: { id: 7000001, is_bot: true, first_name: "Интегро", username: "integro_test_bot" } });
        case "getWebhookInfo":
          return send(res, 200, { ok: true, result: { url: webhook.url, pending_update_count: 0, allowed_updates: webhook.allowed_updates } });
        case "setWebhook":
          webhook = { url: params.url, allowed_updates: params.allowed_updates ?? [] };
          return send(res, 200, { ok: true, result: true });
        case "deleteWebhook":
          webhook = { url: "", allowed_updates: [] };
          return send(res, 200, { ok: true, result: true });
        case "sendMessage":
          messageId += 1;
          return send(res, 200, { ok: true, result: { message_id: messageId, chat: { id: params.chat_id }, date: Math.floor(Date.now() / 1000), text: params.text } });
        case "answerCallbackQuery":
        case "editMessageReplyMarkup":
          return send(res, 200, { ok: true, result: true });
        default:
          return send(res, 400, { ok: false, error_code: 400, description: `Bad Request: method ${method} is not mocked` });
      }
    });
  })
  .listen(port, "127.0.0.1");
