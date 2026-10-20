// Имитация MAX Bot API для сквозных тестов: принимает запросы так же, как platform-api2.max.ru,
// и запоминает их (GET /__requests). Токен проверяется по заголовку Authorization.
import http from "node:http";

const port = Number(process.argv[2] ?? 3203);
const token = process.env.MAX_MOCK_TOKEN ?? "e2e-max-token";
let requests = [];
let mid = 0;
let subscriptions = [];

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
      const parsed = body ? JSON.parse(body) : null;
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization ?? null, body: parsed });
      if (req.headers.authorization !== token) return send(res, 401, { code: "verify.token", message: "Invalid access_token" });
      if (req.method === "GET" && url.pathname === "/me") return send(res, 200, { user_id: 9734021152, first_name: "Интегро", username: "id9734021152_bot", is_bot: true });
      if (req.method === "GET" && url.pathname === "/subscriptions") return send(res, 200, { subscriptions });
      if (req.method === "POST" && url.pathname === "/subscriptions") {
        subscriptions = [{ url: parsed.url, time: Date.now(), update_types: parsed.update_types }];
        return send(res, 200, { success: true });
      }
      if (req.method === "DELETE" && url.pathname === "/subscriptions") {
        subscriptions = subscriptions.filter((s) => s.url !== url.searchParams.get("url"));
        return send(res, 200, { success: true });
      }
      if (req.method === "POST" && url.pathname === "/messages") {
        mid += 1;
        return send(res, 200, { message: { body: { mid: `mock.${mid}`, text: parsed?.text ?? "" }, timestamp: Date.now() } });
      }
      if (req.method === "POST" && url.pathname === "/answers") return send(res, 200, { success: true });
      return send(res, 404, { code: "not.found", message: "Not found" });
    });
  })
  .listen(port, "127.0.0.1");
