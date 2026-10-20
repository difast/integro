import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MaxApiError, maxApi } from "@/lib/max/api";
import { getMaxConfig, isMaxEnabled } from "@/lib/max/config";
import { isWebhookSecretValid } from "@/lib/chat/secret";
import { maxDisplayName, parseUpdate, phoneFromVcf } from "@/lib/max/types";

const SECRET = "a".repeat(40);

describe("MAX: конфигурация", () => {
  it("без токена и секрета бот выключен; значения не раскрываются", () => {
    const config = getMaxConfig({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(config.problems).toEqual(expect.arrayContaining(["token_missing", "secret_missing"]));
    expect(isMaxEnabled(config)).toBe(false);
  });

  it("секрет: только допустимые символы и длина от 32", () => {
    expect(getMaxConfig({ MAX_BOT_TOKEN: "t", MAX_WEBHOOK_SECRET: "short" } as never).problems).toContain("secret_invalid");
    expect(getMaxConfig({ MAX_BOT_TOKEN: "t", MAX_WEBHOOK_SECRET: `${"a".repeat(31)}!` } as never).problems).toContain("secret_invalid");
    expect(isMaxEnabled(getMaxConfig({ MAX_BOT_TOKEN: "t", MAX_WEBHOOK_SECRET: SECRET } as never))).toBe(true);
  });

  it("адрес Webhook по умолчанию — SITE_URL + /api/max/webhook; только https", () => {
    expect(getMaxConfig({ SITE_URL: "https://example.ru/" } as never).webhookUrl).toBe("https://example.ru/api/max/webhook");
    expect(getMaxConfig({ MAX_WEBHOOK_URL: "http://example.ru/hook" } as never).problems).toContain("webhook_url_invalid");
    expect(getMaxConfig({ MAX_WEBHOOK_URL: "https://user:pass@example.ru/hook" } as never).problems).toContain("webhook_url_invalid");
  });

  it("базовый адрес API — platform-api2.max.ru; подмена только на https или localhost", () => {
    expect(getMaxConfig({} as never).apiBaseUrl).toBe("https://platform-api2.max.ru");
    expect(getMaxConfig({ MAX_API_BASE_URL: "http://evil.example" } as never).problems).toContain("api_base_invalid");
    expect(getMaxConfig({ MAX_API_BASE_URL: "http://127.0.0.1:3203" } as never).apiBaseUrl).toBe("http://127.0.0.1:3203");
  });

  it("сертификат в одну строку приводится к PEM", () => {
    const pem = "-----BEGIN CERTIFICATE-----MIIBszCCAVmgAwIBAgIU-----END CERTIFICATE-----";
    expect(getMaxConfig({ MAX_API_CA_CERT: pem } as never).caCert).toBe("-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIU\n-----END CERTIFICATE-----");
  });

  it("секрет Webhook сравнивается точно", () => {
    expect(isWebhookSecretValid(SECRET, SECRET)).toBe(true);
    expect(isWebhookSecretValid(`${SECRET}x`, SECRET)).toBe(false);
    expect(isWebhookSecretValid(null, SECRET)).toBe(false);
    expect(isWebhookSecretValid(SECRET, null)).toBe(false);
  });
});

describe("MAX: разбор событий", () => {
  const user = { user_id: 101, first_name: "Анна", last_name: "Иванова", username: "anna", is_bot: false };

  it("bot_started: пользователь, метка запуска и ключ события", () => {
    const event = parseUpdate({ update_type: "bot_started", timestamp: 1700000000000, chat_id: 5, user, payload: "site" });
    expect(event).toMatchObject({ kind: "start", payload: "site", chatId: 5, key: "bot_started:101:1700000000000" });
  });

  it("message_created: ключ по mid, текст, вложения без ссылок и токенов, телефон из контакта", () => {
    const event = parseUpdate({
      update_type: "message_created",
      timestamp: 1700000000000,
      message: {
        sender: user,
        recipient: { chat_id: 5, chat_type: "dialog" },
        body: {
          mid: "mid.1",
          text: "",
          attachments: [
            { type: "contact", payload: { vcf_info: "BEGIN:VCARD\nTEL;TYPE=cell:+7 900 123-45-67\nEND:VCARD", max_info: user } },
            { type: "file", payload: { url: "https://files/secret", token: "tok" }, filename: "doc.pdf", size: 2048 },
          ],
        },
      },
    });
    expect(event).toMatchObject({ kind: "message", key: "message:mid.1", contactPhone: "+79001234567" });
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(JSON.stringify(event)).not.toContain("tok");
    if (event?.kind === "message") expect(event.attachments).toEqual([{ type: "contact" }, { type: "file", filename: "doc.pdf", size: 2048 }]);
  });

  it("сообщения ботов (в том числе собственные) и групповые чаты игнорируются", () => {
    const fromBot = parseUpdate({
      update_type: "message_created",
      timestamp: 1,
      message: { sender: { user_id: 1, is_bot: true }, recipient: { chat_type: "dialog" }, body: { mid: "m2", text: "hi" } },
    });
    expect(fromBot).toMatchObject({ kind: "ignored", reason: "from_bot" });
    const group = parseUpdate({
      update_type: "message_created",
      timestamp: 1,
      message: { sender: user, recipient: { chat_type: "chat" }, body: { mid: "m3", text: "hi" } },
    });
    expect(group).toMatchObject({ kind: "ignored", reason: "not_dialog" });
  });

  it("message_callback: ключ по callback_id, payload и текст исходного сообщения", () => {
    const event = parseUpdate({
      update_type: "message_callback",
      timestamp: 1700000000000,
      callback: { callback_id: "cb1", payload: "apply", user, timestamp: 1 },
      message: { recipient: { chat_type: "dialog", chat_id: 5 }, body: { mid: "m", text: "Меню" } },
    });
    expect(event).toMatchObject({ kind: "callback", key: "callback:cb1", payload: "apply", sourceText: "Меню" });
  });

  it("неизвестные и неполные события не ломают разбор", () => {
    expect(parseUpdate(null)).toBeNull();
    expect(parseUpdate({})).toBeNull();
    expect(parseUpdate({ update_type: "chat_title_changed", timestamp: 1 })).toMatchObject({ kind: "ignored", reason: "unsupported" });
    expect(parseUpdate({ update_type: "message_created", timestamp: 1, message: {} })).toMatchObject({ kind: "ignored" });
  });

  it("телефон из vCard и отображаемое имя", () => {
    expect(phoneFromVcf("TEL:89001234567")).toBe("89001234567");
    expect(phoneFromVcf("TEL:123")).toBeNull();
    expect(maxDisplayName({ first_name: "Анна", last_name: "Иванова" })).toBe("Анна Иванова");
    expect(maxDisplayName({ username: "anna" })).toBe("@anna");
  });
});

describe("MAX: HTTP-клиент", () => {
  const requests: { method: string; url: string; auth: string | undefined; body: string }[] = [];
  let mode: "ok" | "429-then-ok" | "401" | "500" = "ok";
  let attempts = 0;
  let server: http.Server;
  const env = { ...process.env };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        requests.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body });
        attempts++;
        if (mode === "401") return res.writeHead(401).end(JSON.stringify({ code: "verify.token", message: "Invalid access_token" }));
        if (mode === "500") return res.writeHead(500).end(JSON.stringify({ code: "internal", message: "boom" }));
        if (mode === "429-then-ok" && attempts === 1) return res.writeHead(429, { "retry-after": "0.01" }).end("{}");
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ message: { body: { mid: "mid.out" } } }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.MAX_BOT_TOKEN = "test-token-123";
    process.env.MAX_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    process.env = env;
    await new Promise((resolve) => server.close(resolve));
  });

  it("токен — только в заголовке Authorization, не в адресе", async () => {
    mode = "ok";
    const result = await maxApi.sendToUser(101, { text: "Здравствуйте" });
    expect(result.message?.body?.mid).toBe("mid.out");
    const last = requests.at(-1)!;
    expect(last).toMatchObject({ method: "POST", url: "/messages?user_id=101", auth: "test-token-123" });
    expect(last.url).not.toContain("token");
    expect(JSON.parse(last.body)).toEqual({ text: "Здравствуйте" });
  });

  it("лимит запросов (429): безопасный повтор", async () => {
    mode = "429-then-ok";
    attempts = 0;
    await expect(maxApi.sendToUser(101, { text: "x" })).resolves.toBeTruthy();
    expect(attempts).toBe(2);
  });

  it("401 и 500: ошибка без повтора, без токена в тексте", async () => {
    mode = "401";
    attempts = 0;
    const error = await maxApi.getMe().catch((e) => e);
    expect(error).toBeInstanceOf(MaxApiError);
    expect(error.status).toBe(401);
    expect(error.summary).not.toContain("test-token-123");
    mode = "500";
    attempts = 0;
    const error500 = await maxApi.sendToUser(1, { text: "x" }).catch((e) => e);
    expect(error500.kind).toBe("http");
    expect(attempts).toBe(1);
  });

  it("нет соединения: вид connect (повтор безопасен)", async () => {
    process.env.MAX_API_BASE_URL = "http://127.0.0.1:9";
    const error = await maxApi.getMe().catch((e) => e);
    expect(error).toBeInstanceOf(MaxApiError);
    expect(error.kind).toBe("connect");
    expect(error.retryable).toBe(true);
  });
});

describe("MAX: значения в кавычках", () => {
  it("кавычки вокруг токена и секрета отбрасываются", () => {
    const config = getMaxConfig({ MAX_BOT_TOKEN: '"tok"', MAX_WEBHOOK_SECRET: `'${"b".repeat(40)}'` } as never);
    expect(config.token).toBe("tok");
    expect(config.secret).toBe("b".repeat(40));
    expect(isMaxEnabled(config)).toBe(true);
  });
});
