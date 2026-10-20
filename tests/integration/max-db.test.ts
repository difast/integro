import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Чат-бот MAX с базой PostgreSQL (TEST_DATABASE_URL) и имитацией MAX API. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Api = typeof import("@/lib/max/api");
type Processor = typeof import("@/lib/max/processor");
type Repo = typeof import("@/lib/max/repository");
let db: Db;
let api: Api;
let processor: Processor;
let repo: Repo;

type Call = { method: string; path: string; query?: Record<string, unknown>; body?: unknown };
let calls: Call[] = [];
let failNext: "http" | "unknown" | "connect" | null = null;
let mid = 0;

const user = { user_id: 555001, first_name: "Анна", last_name: "Иванова", username: "anna_test", is_bot: false };
let ts = 1_700_000_000_000;

function message(text: string, extra: Record<string, unknown> = {}) {
  ts += 1000;
  return {
    update_type: "message_created",
    timestamp: ts,
    message: { sender: user, recipient: { chat_id: 77, chat_type: "dialog" }, timestamp: ts, body: { mid: `in.${ts}`, text, ...extra } },
  };
}
function callback(payload: string) {
  ts += 1000;
  return {
    update_type: "message_callback",
    timestamp: ts,
    callback: { callback_id: `cb.${ts}`, payload, user, timestamp: ts },
    message: { recipient: { chat_id: 77, chat_type: "dialog" }, body: { mid: `out.prev.${ts}`, text: "Предыдущее сообщение" } },
  };
}
function started() {
  ts += 1000;
  return { update_type: "bot_started", timestamp: ts, chat_id: 77, user, payload: "site" };
}

async function deliver(update: unknown) {
  const stored = await processor.storeEvent(update);
  if (stored && !stored.duplicate) await processor.processEvent(stored.id);
  return stored;
}

const sent = () => calls.filter((c) => c.path === "messages");
const clientRow = async () => (await db.query<Record<string, unknown>>("SELECT * FROM max_clients WHERE max_user_id = $1", [user.user_id]))[0]!;

suite("чат-бот MAX и база", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.MAX_BOT_TOKEN = "integration-token";
    process.env.MAX_WEBHOOK_SECRET = "s".repeat(40);
    db = await import("@/lib/db");
    api = await import("@/lib/max/api");
    processor = await import("@/lib/max/processor");
    repo = await import("@/lib/max/repository");
    await db.ensureSchema();
    api.setMaxTransport(async (_config, options) => {
      calls.push({ method: options.method, path: options.path, query: options.query, body: options.body });
      if (failNext) {
        const kind = failNext;
        failNext = null;
        if (kind === "http") throw new api.MaxApiError("http", "chat not found", 404, "not.found");
        if (kind === "unknown") throw new api.MaxApiError("unknown", "MAX API не ответил за 10 секунд; результат неизвестен.");
        throw new api.MaxApiError("connect", "Нет соединения с MAX API (ECONNREFUSED).");
      }
      if (options.path === "messages") return { message: { body: { mid: `out.${++mid}` } } };
      return { success: true };
    });
  });

  beforeEach(async () => {
    calls = [];
    failNext = null;
    await db.query("TRUNCATE max_messages, max_notes, max_events, requests, max_clients RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    api?.setMaxTransport(null);
    await db?.closePool();
  });

  it("первый запуск: карточка клиента, входящее событие, приветствие отправлено через API", async () => {
    await deliver(started());
    const client = await clientRow();
    expect(client).toMatchObject({ first_name: "Анна", last_name: "Иванова", username: "anna_test", source: "site", mode: "bot", status: "open" });
    expect(String(client.chat_id)).toBe("77");
    expect(sent()).toHaveLength(1);
    expect(sent()[0]!.query).toEqual({ user_id: user.user_id });
    expect((sent()[0]!.body as { text: string }).text).toContain("ООО «Интегро»");
    const messages = await db.query<{ direction: string; status: string; external_mid: string | null }>(
      "SELECT direction, status, external_mid FROM max_messages ORDER BY id",
    );
    expect(messages).toEqual([
      { direction: "in", status: "received", external_mid: null },
      { direction: "out", status: "sent", external_mid: "out.1" },
    ]);
  });

  it("повторная доставка события: без дублей и без второго ответа", async () => {
    const update = message("Привет");
    const first = await deliver(update);
    const second = await deliver(update);
    expect(first?.duplicate).toBe(false);
    expect(second?.duplicate).toBe(true);
    await processor.processEvent(first!.id); // повторная обработка того же события — ничего не делает
    expect(sent()).toHaveLength(1);
    expect((await db.query("SELECT id FROM max_messages WHERE direction = 'in'")).length).toBe(1);
  });

  it("повторное обращение — та же карточка (связь по ID пользователя MAX, а не по имени)", async () => {
    await deliver(started());
    user.first_name = "Анна-Мария";
    await deliver(message("меню"));
    user.first_name = "Анна";
    const clients = await db.query<{ first_name: string }>("SELECT first_name FROM max_clients");
    expect(clients).toEqual([{ first_name: "Анна-Мария" }]);
  });

  it("заявка из чат-бота: согласие, данные, подтверждение, номер заявки, запись в requests", async () => {
    await deliver(started());
    await deliver(callback("apply"));
    // Нажатие убирает клавиатуру у прежнего сообщения.
    expect(calls.find((c) => c.path === "answers")).toMatchObject({ body: { message: { text: "Предыдущее сообщение", attachments: [] } } });
    await deliver(callback("consent:yes"));
    await deliver(message("Анна"));
    await deliver(callback("dir:ocenka"));
    await deliver(message("Оценка квартиры для вступления в наследство"));
    await deliver(message("+7 900 123-45-67"));
    await deliver(callback("skip"));
    await deliver(callback("confirm"));
    await deliver(callback("confirm")); // повторное нажатие устаревшей кнопки

    const requests = await db.query<Record<string, unknown>>("SELECT * FROM requests");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      name: "Анна",
      phone: "+7 900 123-45-67",
      service: "ocenka",
      service_title: "Оценочная деятельность",
      channel: "max",
      context: "Чат-бот MAX",
      status: "new",
    });
    const client = await clientRow();
    expect(requests[0]!.max_client_id).toBe(client.id);
    expect(client).toMatchObject({ phone: "+7 900 123-45-67", needs_reply: true });
    expect(client.consent_at).toBeTruthy();
    const number = processor.requestNumber(String(requests[0]!.id));
    expect(sent().some((c) => (c.body as { text: string }).text.includes(`Заявка № ${number} принята`))).toBe(true);
    expect(await repo.getMaxClient(String(client.id))).toMatchObject({ requestCount: 1 });
  });

  it("режим оператора: бот молчит, диалог ждёт ответа; ответ оператора уходит в MAX один раз", async () => {
    await deliver(started());
    const client = await clientRow();
    const id = String(client.id);
    await repo.updateMaxClient(id, { mode: "operator" });
    calls = [];
    await deliver(message("Есть вопрос по экспертизе"));
    expect(sent()).toHaveLength(0);
    expect((await clientRow()).needs_reply).toBe(true);

    const key = randomUUID();
    const reply = await repo.sendOperatorReply(id, "Здравствуйте! Подскажите номер дела.", key);
    expect(reply.status).toBe("sent");
    const again = await repo.sendOperatorReply(id, "Здравствуйте! Подскажите номер дела.", key);
    expect(again.duplicate).toBe(true);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]!.body).toEqual({ text: "Здравствуйте! Подскажите номер дела." });
    expect(await clientRow()).toMatchObject({ needs_reply: false, mode: "operator" });

    // Возврат боту: снова отвечает по сценарию с главного меню.
    await repo.updateMaxClient(id, { mode: "bot" });
    calls = [];
    await deliver(message("меню"));
    expect(sent()).toHaveLength(1);
  });

  it("ответ оператора переключает диалог в режим оператора", async () => {
    await deliver(started());
    const id = String((await clientRow()).id);
    await repo.sendOperatorReply(id, "Добрый день", randomUUID());
    expect((await clientRow()).mode).toBe("operator");
    calls = [];
    await deliver(callback("sec:ocenka"));
    expect(sent()).toHaveLength(0);
    expect(calls.find((c) => c.path === "answers")?.body).toEqual({ notification: "Сейчас с вами общается специалист — напишите сообщение в чат." });
  });

  it("ошибка MAX API: статус failed, повтор вручную; неизвестный результат — повтор только с подтверждением", async () => {
    await deliver(started());
    const id = String((await clientRow()).id);

    failNext = "http";
    const failed = await repo.sendOperatorReply(id, "Первый ответ", randomUUID());
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("404");
    expect(await repo.retryMaxMessage(id, failed.messageId!, false)).toMatchObject({ status: "sent" });

    failNext = "unknown";
    const unknown = await repo.sendOperatorReply(id, "Второй ответ", randomUUID());
    expect(unknown.status).toBe("unknown");
    expect(await repo.retryMaxMessage(id, unknown.messageId!, false)).toMatchObject({ status: "skipped" });
    expect(await repo.retryMaxMessage(id, unknown.messageId!, true)).toMatchObject({ status: "sent" });

    // Уже отправленное сообщение повторно не отправляется.
    expect(await repo.retryMaxMessage(id, unknown.messageId!, true)).toMatchObject({ status: "skipped" });
  });

  it("единичный сбой соединения при автоответе повторяется автоматически", async () => {
    failNext = "connect";
    await deliver(started());
    const rows = await db.query<{ status: string }>("SELECT status FROM max_messages WHERE direction = 'out'");
    expect(rows[0]!.status).toBe("sent"); // после одного сбоя соединения повтор прошёл
  });

  it("клиент остановил бота: отправка не выполняется, после нового запуска — снова доступна", async () => {
    await deliver(started());
    const id = String((await clientRow()).id);
    ts += 1000;
    await deliver({ update_type: "bot_stopped", timestamp: ts, chat_id: 77, user });
    expect((await clientRow()).bot_blocked).toBe(true);
    calls = [];
    const result = await repo.sendOperatorReply(id, "Ответ", randomUUID());
    expect(result.status).toBe("failed");
    expect(sent()).toHaveLength(0);
    await deliver(started());
    expect((await clientRow()).bot_blocked).toBe(false);
  });

  it("незавершённые отправки и события доделывает фоновая проверка", async () => {
    await deliver(started());
    const client = await clientRow();
    await db.query(
      `INSERT INTO max_messages (client_id, direction, author, kind, text, status, created_at)
       VALUES ($1, 'out', 'bot', 'text', 'Повисшее сообщение', 'pending', now() - interval '5 minutes')`,
      [client.id],
    );
    await db.query(
      `INSERT INTO max_messages (client_id, direction, author, kind, text, status, claimed_at)
       VALUES ($1, 'out', 'operator', 'text', 'Прерванная отправка', 'sending', now() - interval '5 minutes')`,
      [client.id],
    );
    calls = [];
    await processor.sweepMax();
    const rows = await db.query<{ text: string; status: string }>("SELECT text, status FROM max_messages WHERE text IN ('Повисшее сообщение', 'Прерванная отправка') ORDER BY id");
    expect(rows).toEqual([
      { text: "Повисшее сообщение", status: "sent" },
      { text: "Прерванная отправка", status: "unknown" },
    ]);
  });

  it("список обращений: поиск по имени, ID, телефону и тексту; фильтр «ждут ответа»", async () => {
    await deliver(started());
    await deliver(message("Нужна рецензия на заключение эксперта"));
    await deliver(callback("specialist"));
    const base = { filter: "" as const, period: "" as const, page: 1 };
    expect((await repo.listMaxClients({ ...base, q: "анна" })).total).toBe(1);
    expect((await repo.listMaxClients({ ...base, q: String(user.user_id) })).total).toBe(1);
    expect((await repo.listMaxClients({ ...base, q: "рецензия" })).total).toBe(1);
    expect((await repo.listMaxClients({ ...base, q: "нет-такого" })).total).toBe(0);
    expect((await repo.listMaxClients({ ...base, q: "", filter: "needs_reply" })).total).toBe(1);
    expect((await repo.listMaxClients({ ...base, q: "%" })).total).toBe(0);
    const { items } = await repo.listMaxMessages(String((await clientRow()).id));
    expect(items.map((m) => m.direction)).toContain("in");
  });

  it("удаление карточки удаляет переписку, заявки остаются", async () => {
    await deliver(started());
    const id = String((await clientRow()).id);
    await repo.addMaxNote(id, "Внутренняя заметка");
    await db.query(
      `INSERT INTO requests (submission_key, name, service_title, message, consent_revision, channel, max_client_id)
       VALUES ($1, 'Анна', 'Не выбрано', 'Текст заявки для теста', '19.10.2026', 'max', $2)`,
      [randomUUID(), id],
    );
    await repo.deleteMaxClient(id);
    expect((await db.query("SELECT id FROM max_messages")).length).toBe(0);
    expect((await db.query("SELECT id FROM max_notes")).length).toBe(0);
    expect(await db.query("SELECT max_client_id FROM requests")).toEqual([{ max_client_id: null }]);
  });
});
