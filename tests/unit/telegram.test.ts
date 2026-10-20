import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TelegramApiError, telegramApi } from "@/lib/telegram/api";
import { toTelegramMarkup, telegramAdapter } from "@/lib/telegram/adapter";
import { getTelegramConfig, isTelegramEnabled } from "@/lib/telegram/config";
import { parseTelegramUpdate, telegramUpdateType } from "@/lib/telegram/types";

const TOKEN = "123456789:AAE_test-token-value-0123456789abcd";
const SECRET = "t".repeat(40);
const user = { id: 4242, is_bot: false, first_name: "Мария", last_name: "Орлова", username: "m_orlova" };
const privateChat = { id: 4242, type: "private" };

describe("Telegram: конфигурация", () => {
  it("без токена и секрета бот выключен", () => {
    const config = getTelegramConfig({} as never);
    expect(config.problems).toEqual(expect.arrayContaining(["token_missing", "secret_missing"]));
    expect(isTelegramEnabled(config)).toBe(false);
  });

  it("формат токена и секрета; кавычки отбрасываются", () => {
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: "abc", TELEGRAM_WEBHOOK_SECRET: SECRET } as never).problems).toContain("token_invalid");
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: "short" } as never).problems).toContain("secret_invalid");
    const quoted = getTelegramConfig({ TELEGRAM_BOT_TOKEN: `"${TOKEN}"`, TELEGRAM_WEBHOOK_SECRET: `'${SECRET}'` } as never);
    expect(isTelegramEnabled(quoted)).toBe(true);
    expect(quoted.token).toBe(TOKEN);
  });

  it("адрес Webhook: по умолчанию SITE_URL + /api/telegram/webhook; только https и допустимые порты", () => {
    expect(getTelegramConfig({ SITE_URL: "https://example.ru" } as never).webhookUrl).toBe("https://example.ru/api/telegram/webhook");
    expect(getTelegramConfig({ TELEGRAM_WEBHOOK_URL: "https://example.ru:8443/hook" } as never).webhookUrl).toBe("https://example.ru:8443/hook");
    expect(getTelegramConfig({ TELEGRAM_WEBHOOK_URL: "https://example.ru:3000/hook" } as never).problems).toContain("webhook_url_invalid");
    expect(getTelegramConfig({ TELEGRAM_WEBHOOK_URL: "http://example.ru/hook" } as never).problems).toContain("webhook_url_invalid");
  });

  it("username — без @; подмена API только на https или localhost", () => {
    expect(getTelegramConfig({ TELEGRAM_BOT_USERNAME: "@integro_bot" } as never).username).toBe("integro_bot");
    expect(getTelegramConfig({ TELEGRAM_BOT_USERNAME: "bad name" } as never).problems).toContain("username_invalid");
    expect(getTelegramConfig({ TELEGRAM_API_BASE_URL: "http://evil.example" } as never).problems).toContain("api_base_invalid");
    expect(getTelegramConfig({} as never).apiBaseUrl).toBe("https://api.telegram.org");
  });
});

describe("Telegram: разбор Update", () => {
  it("/start с меткой; ключ — update_id", () => {
    const event = parseTelegramUpdate({ update_id: 10, message: { message_id: 1, from: user, chat: privateChat, date: 1_700_000_000, text: "/start site" } });
    expect(event).toMatchObject({ kind: "start", payload: "site", key: "tg:10", chatId: 4242, user: { id: 4242, firstName: "Мария", username: "m_orlova" } });
  });

  it("текст, подпись к файлу и метаданные вложений без file_id", () => {
    const event = parseTelegramUpdate({
      update_id: 11,
      message: { message_id: 2, from: user, chat: privateChat, date: 1_700_000_001, caption: "Договор", document: { file_id: "SECRET_FILE", file_name: "dogovor.pdf", file_size: 1000, mime_type: "application/pdf" } },
    });
    expect(event).toMatchObject({ kind: "message", text: "Договор", messageKey: "tg:4242:2", messageId: "2" });
    if (event?.kind === "message") expect(event.attachments).toEqual([{ type: "document", filename: "dogovor.pdf", size: 1000, mime: "application/pdf" }]);
    expect(JSON.stringify(event)).not.toContain("SECRET_FILE");
  });

  it("контакт: номер принимается только из собственного контакта пользователя", () => {
    const own = parseTelegramUpdate({ update_id: 12, message: { message_id: 3, from: user, chat: privateChat, date: 1, contact: { phone_number: "79001234567", user_id: 4242 } } });
    expect(own).toMatchObject({ kind: "message", contactPhone: "+79001234567" });
    const foreign = parseTelegramUpdate({ update_id: 13, message: { message_id: 4, from: user, chat: privateChat, date: 1, contact: { phone_number: "79005554433", user_id: 1 } } });
    expect(foreign).toMatchObject({ kind: "message", contactPhone: null });
  });

  it("нажатие кнопки: callback_query с данными и ID нажатого сообщения", () => {
    const event = parseTelegramUpdate({
      update_id: 14,
      callback_query: { id: "cbq1", from: user, data: "sec:ocenka", message: { message_id: 7, chat: privateChat, date: 1, text: "Меню" } },
    });
    expect(event).toMatchObject({ kind: "callback", callbackId: "cbq1", payload: "sec:ocenka", sourceMessageId: "7", sourceText: "Меню", key: "tg:14" });
  });

  it("блокировка и разблокировка бота (my_chat_member)", () => {
    const stop = parseTelegramUpdate({ update_id: 15, my_chat_member: { chat: privateChat, from: user, date: 1, old_chat_member: { status: "member" }, new_chat_member: { status: "kicked" } } });
    expect(stop).toMatchObject({ kind: "stop" });
    const resume = parseTelegramUpdate({ update_id: 16, my_chat_member: { chat: privateChat, from: user, date: 1, old_chat_member: { status: "kicked" }, new_chat_member: { status: "member" } } });
    expect(resume).toMatchObject({ kind: "resume" });
  });

  it("боты, группы и неизвестные типы игнорируются", () => {
    expect(parseTelegramUpdate({ update_id: 17, message: { message_id: 1, from: { ...user, is_bot: true }, chat: privateChat, date: 1, text: "hi" } })).toMatchObject({ kind: "ignored", reason: "from_bot" });
    expect(parseTelegramUpdate({ update_id: 18, message: { message_id: 1, from: user, chat: { id: -100, type: "supergroup" }, date: 1, text: "hi" } })).toMatchObject({ kind: "ignored", reason: "not_private" });
    expect(parseTelegramUpdate({ update_id: 19, edited_message: {} })).toMatchObject({ kind: "ignored", reason: "unsupported" });
    expect(parseTelegramUpdate({ message: {} })).toBeNull();
    expect(telegramUpdateType({ update_id: 1, callback_query: {} })).toBe("callback_query");
  });
});

describe("Telegram: клавиатуры", () => {
  it("обычные кнопки — inline с callback_data", () => {
    expect(toTelegramMarkup([[{ type: "callback", text: "Оценка", payload: "sec:ocenka" }]])).toEqual({ inline_keyboard: [[{ text: "Оценка", callback_data: "sec:ocenka" }]] });
  });

  it("кнопка «Отправить мой номер» — обычная клавиатура с request_contact", () => {
    expect(
      toTelegramMarkup([[{ type: "request_contact", text: "Отправить мой номер" }], [{ type: "callback", text: "Пропустить", payload: "skip" }]]),
    ).toEqual({ keyboard: [[{ text: "Отправить мой номер", request_contact: true }], [{ text: "Пропустить" }]], resize_keyboard: true, one_time_keyboard: true });
    expect(toTelegramMarkup(undefined, true)).toEqual({ remove_keyboard: true });
  });

  it("после шага телефона клавиатура убирается", () => {
    const replies = telegramAdapter.adaptReplies!("phone", "contact_time", [{ text: "Когда удобно?", buttons: [[{ type: "callback", text: "Пропустить", payload: "skip" }]] }]);
    expect(replies[0]).toEqual({ text: "Принято.", removeKeyboard: true });
    expect(replies).toHaveLength(2);
    const cancelled = telegramAdapter.adaptReplies!("phone", "menu", [{ text: "Оформление заявки отменено." }, { text: "Меню", buttons: [[]] }]);
    expect(cancelled[0]).toMatchObject({ removeKeyboard: true });
    expect(cancelled).toHaveLength(2);
  });

  it("все подписи и данные кнопок сценария укладываются в 64 байта", async () => {
    const { keyboards } = await import("@/lib/chat/scenario");
    for (const make of Object.values(keyboards)) {
      for (const button of (make as () => { type: string; payload?: string }[][])().flat()) {
        if (button.payload) expect(Buffer.byteLength(button.payload)).toBeLessThanOrEqual(64);
      }
    }
  });
});

describe("Telegram: клиент Bot API", () => {
  const requests: { url: string; body: unknown }[] = [];
  let mode: "ok" | "403" | "429-then-ok" | "401" | "leak" = "ok";
  let attempts = 0;
  let server: http.Server;
  const env = { ...process.env };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        requests.push({ url: req.url!, body: JSON.parse(body || "{}") });
        attempts++;
        const send = (status: number, data: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data));
        if (mode === "403") return send(403, { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" });
        if (mode === "401") return send(401, { ok: false, error_code: 401, description: "Unauthorized" });
        if (mode === "leak") return send(400, { ok: false, error_code: 400, description: `Bad Request: bot${TOKEN} something` });
        if (mode === "429-then-ok" && attempts === 1) return send(429, { ok: false, error_code: 429, description: "Too Many Requests: retry after 1", parameters: { retry_after: 0.01 } });
        send(200, { ok: true, result: { message_id: 99, chat: { id: 4242 }, date: 1 } });
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    process.env = env;
    await new Promise((resolve) => server.close(resolve));
  });

  it("sendMessage: POST /bot<токен>/sendMessage, текст без разметки, превью ссылок отключено", async () => {
    mode = "ok";
    const sent = await telegramApi.sendMessage(4242, "Здравствуйте", { inline_keyboard: [[{ text: "Меню", callback_data: "menu" }]] });
    expect(sent.message_id).toBe(99);
    const last = requests.at(-1)!;
    expect(last.url).toBe(`/bot${TOKEN}/sendMessage`);
    expect(last.body).toEqual({
      chat_id: 4242,
      text: "Здравствуйте",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: [[{ text: "Меню", callback_data: "menu" }]] },
    });
  });

  it("setWebhook: адрес, секрет, allowed_updates", async () => {
    mode = "ok";
    await telegramApi.setWebhook("https://example.ru/api/telegram/webhook", SECRET);
    expect(requests.at(-1)!.body).toEqual({
      url: "https://example.ru/api/telegram/webhook",
      secret_token: SECRET,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
      max_connections: 10,
    });
  });

  it("403 — пользователь заблокировал бота; без повторов", async () => {
    mode = "403";
    attempts = 0;
    const error = await telegramApi.sendMessage(4242, "x").catch((e) => e);
    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.blocked).toBe(true);
    expect(attempts).toBe(1);
  });

  it("429 — повтор после retry_after", async () => {
    mode = "429-then-ok";
    attempts = 0;
    await expect(telegramApi.sendMessage(4242, "x")).resolves.toMatchObject({ message_id: 99 });
    expect(attempts).toBe(2);
  });

  it("токен не попадает в тексты ошибок", async () => {
    mode = "401";
    const unauthorized = await telegramApi.getMe().catch((e) => e);
    expect(unauthorized.summary).not.toContain(TOKEN);
    expect(unauthorized.summary).toContain("TELEGRAM_BOT_TOKEN");
    mode = "leak";
    const leak = await telegramApi.getMe().catch((e) => e);
    expect(leak.summary).not.toContain(TOKEN);
    process.env.TELEGRAM_API_BASE_URL = "http://127.0.0.1:9";
    const refused = await telegramApi.getMe().catch((e) => e);
    expect(refused.kind).toBe("connect");
    expect(refused.summary).not.toContain(TOKEN);
  });
});
