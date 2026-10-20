import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Telegram-бот с базой PostgreSQL (TEST_DATABASE_URL) и имитацией Bot API. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Api = typeof import("@/lib/telegram/api");
type Processor = typeof import("@/lib/chat/processor");
type Repo = typeof import("@/lib/chat/repository");
let db: Db;
let api: Api;
let processor: Processor;
let repo: Repo;

type Call = { method: string; params: Record<string, unknown> };
let calls: Call[] = [];
let failNext: "403" | "400" | "unknown" | null = null;
let messageId = 1000;
let updateId = 5000;

const user = { id: 555001, is_bot: false, first_name: "Мария", last_name: "Орлова", username: "m_orlova" };
const chat = { id: 555001, type: "private" };

function text(value: string) {
  updateId += 1;
  messageId += 1;
  return { update_id: updateId, message: { message_id: messageId, from: user, chat, date: Math.floor(Date.now() / 1000), text: value } };
}
function press(data: string, sourceMessageId = 1) {
  updateId += 1;
  return { update_id: updateId, callback_query: { id: `cbq${updateId}`, from: user, data, message: { message_id: sourceMessageId, chat, date: 1, text: "Предыдущее сообщение" } } };
}
function contact(phone: string, ownerId = user.id) {
  updateId += 1;
  messageId += 1;
  return { update_id: updateId, message: { message_id: messageId, from: user, chat, date: Math.floor(Date.now() / 1000), contact: { phone_number: phone, user_id: ownerId } } };
}

async function deliver(update: unknown) {
  const stored = await processor.storeEvent("telegram", update);
  if (stored && !stored.duplicate) await processor.processEvent(stored.id);
  return stored;
}

const sends = () => calls.filter((c) => c.method === "sendMessage");
const client = async () => (await db.query<Record<string, unknown>>("SELECT * FROM chat_clients WHERE channel = 'telegram' AND external_user_id = $1", [user.id]))[0]!;

suite("Telegram-бот и база", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAE_integration-token-0123456789ab";
    process.env.TELEGRAM_WEBHOOK_SECRET = "w".repeat(40);
    db = await import("@/lib/db");
    api = await import("@/lib/telegram/api");
    processor = await import("@/lib/chat/processor");
    repo = await import("@/lib/chat/repository");
    await db.ensureSchema();
    api.setTelegramTransport(async (_config, method, params) => {
      calls.push({ method, params });
      if (failNext && method === "sendMessage") {
        const kind = failNext;
        failNext = null;
        if (kind === "403") throw new api.TelegramApiError("http", "Forbidden: bot was blocked by the user", 403);
        if (kind === "400") throw new api.TelegramApiError("http", "Bad Request: chat not found", 400);
        throw new api.TelegramApiError("unknown", "Telegram API не ответил за 10 секунд; результат неизвестен.");
      }
      if (method === "sendMessage") return { message_id: ++messageId, chat: { id: params.chat_id }, date: 1 };
      return true;
    });
  });

  beforeEach(async () => {
    calls = [];
    failNext = null;
    await db.query("TRUNCATE chat_messages, chat_notes, chat_events, requests, chat_clients RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    api?.setTelegramTransport(null);
    await db?.closePool();
  });

  it("/start: карточка клиента Telegram, приветствие с inline-меню отправлено через sendMessage", async () => {
    await deliver(text("/start"));
    expect(await client()).toMatchObject({ channel: "telegram", first_name: "Мария", username: "m_orlova", mode: "bot" });
    expect(sends()).toHaveLength(1);
    const params = sends()[0]!.params;
    expect(params.chat_id).toBe(chat.id);
    expect(params.text).toContain("ООО «Интегро»");
    expect((params.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      "sec:ocenka",
      "sec:sudeb",
      "sec:issled",
      "apply",
      "specialist",
    ]);
    const stored = await db.query<{ direction: string; external_message_id: string | null; external_chat_id: string | null; external_user_id: string | null; status: string }>(
      "SELECT direction, external_message_id, external_chat_id, external_user_id, status FROM chat_messages ORDER BY id",
    );
    expect(stored[0]).toMatchObject({ direction: "in", status: "received" });
    expect(String(stored[0]!.external_chat_id)).toBe(String(chat.id));
    expect(String(stored[0]!.external_user_id)).toBe(String(user.id));
    expect(stored[1]).toMatchObject({ direction: "out", status: "sent" });
    expect(stored[1]!.external_message_id).toMatch(/^\d+$/);
  });

  it("повторная доставка Update не создаёт дублей и второго ответа", async () => {
    const update = text("Привет");
    expect((await deliver(update))?.duplicate).toBe(false);
    expect((await deliver(update))?.duplicate).toBe(true);
    expect(sends()).toHaveLength(1);
    expect((await db.query("SELECT id FROM chat_messages WHERE direction = 'in'")).length).toBe(1);
  });

  it("один и тот же числовой ID в MAX и Telegram — разные клиенты; username не используется как ключ", async () => {
    await deliver(text("/start"));
    await db.query("INSERT INTO chat_clients (channel, external_user_id, first_name) VALUES ('max', $1, 'Мария')", [user.id]);
    const before = await client();
    user.username = "new_username";
    await deliver(text("меню"));
    user.username = "m_orlova";
    const after = await client();
    expect(after.id).toBe(before.id);
    expect(after.username).toBe("new_username");
    expect((await db.query("SELECT id FROM chat_clients")).length).toBe(2);
  });

  it("нажатие кнопки: answerCallbackQuery и снятие клавиатуры с нажатого сообщения", async () => {
    await deliver(text("/start"));
    calls = [];
    await deliver(press("sec:ocenka", 77));
    expect(calls.find((c) => c.method === "answerCallbackQuery")?.params).toMatchObject({ callback_query_id: expect.stringMatching(/^cbq/) });
    expect(calls.find((c) => c.method === "editMessageReplyMarkup")?.params).toEqual({ chat_id: chat.id, message_id: 77, reply_markup: { inline_keyboard: [] } });
    expect(String(sends()[0]!.params.text)).toContain("недвижимое имущество");
  });

  it("заявка: request_contact, снятие клавиатуры, подтверждение, запись в requests с каналом telegram", async () => {
    await deliver(text("/start"));
    await deliver(press("apply"));
    await deliver(press("consent:yes"));
    await deliver(text("Мария"));
    await deliver(press("dir:issled"));
    calls = [];
    await deliver(text("Нужна рецензия на отчёт об оценке квартиры"));
    const phonePrompt = sends().at(-1)!.params.reply_markup as { keyboard: { text: string; request_contact?: boolean }[][]; one_time_keyboard: boolean };
    expect(phonePrompt.keyboard[0]).toEqual([{ text: "Отправить мой номер", request_contact: true }]);
    expect(phonePrompt.one_time_keyboard).toBe(true);

    calls = [];
    await deliver(contact("+7 900 111-22-33"));
    expect(sends()[0]!.params.reply_markup).toEqual({ remove_keyboard: true });
    await deliver(press("skip"));
    await deliver(press("confirm"));

    const requests = await db.query<Record<string, unknown>>("SELECT * FROM requests");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ name: "Мария", phone: "+79001112233", service: "ekspertnye-issledovaniya", channel: "telegram", context: "Telegram-бот" });
    const card = await client();
    expect(requests[0]!.chat_client_id).toBe(card.id);
    expect(card).toMatchObject({ phone: "+79001112233", needs_reply: true });
    const number = processor.requestNumber(String(requests[0]!.id));
    expect(sends().some((c) => String(c.params.text).includes(`Заявка № ${number} принята`))).toBe(true);
  });

  it("чужой контакт не принимается как телефон клиента", async () => {
    await deliver(text("/start"));
    await deliver(press("apply"));
    await deliver(press("consent:yes"));
    await deliver(text("Мария"));
    await deliver(press("dir:ocenka"));
    await deliver(text("Оценка квартиры для нотариуса"));
    calls = [];
    await deliver(contact("+7 999 000-00-00", 1));
    expect((await client()).phone).toBe("");
    expect(String(sends()[0]!.params.text)).toContain("Не удалось распознать номер");
  });

  it("неподдерживаемый формат (стикер): вежливая просьба написать текстом", async () => {
    await deliver(text("/start"));
    calls = [];
    updateId += 1;
    messageId += 1;
    await deliver({ update_id: updateId, message: { message_id: messageId, from: user, chat, date: 1, sticker: { file_id: "x" } } });
    expect(String(sends()[0]!.params.text)).toContain("Напишите, пожалуйста, вопрос текстом");
    const stored = await db.query<{ kind: string; attachments: unknown }>("SELECT kind, attachments FROM chat_messages WHERE direction = 'in' ORDER BY id DESC LIMIT 1");
    expect(stored[0]).toEqual({ kind: "attachment", attachments: [{ type: "sticker" }] });
  });

  it("ответ оператора уходит через sendMessage один раз; режим оператора; возврат боту", async () => {
    await deliver(text("/start"));
    const id = String((await client()).id);
    calls = [];
    const key = randomUUID();
    const sent = await repo.sendOperatorReply(id, "Здравствуйте, Мария! Чем помочь?", key);
    expect(sent.status).toBe("sent");
    expect((await repo.sendOperatorReply(id, "Здравствуйте, Мария! Чем помочь?", key)).duplicate).toBe(true);
    expect(sends()).toHaveLength(1);
    expect(sends()[0]!.params).toMatchObject({ chat_id: chat.id, text: "Здравствуйте, Мария! Чем помочь?" });
    expect(sends()[0]!.params.reply_markup).toBeUndefined();
    expect((await client()).mode).toBe("operator");

    calls = [];
    await deliver(text("Спасибо, вопрос по делу"));
    expect(sends()).toHaveLength(0);
    expect((await client()).needs_reply).toBe(true);

    await repo.updateChatClient(id, { mode: "bot" });
    await deliver(text("/help"));
    expect(String(sends()[0]!.params.text)).toContain("/cancel");
  });

  it("403 при отправке: статус failed, клиент помечен как заблокировавший бота; разблокировка возвращает доставку", async () => {
    await deliver(text("/start"));
    const id = String((await client()).id);
    failNext = "403";
    const result = await repo.sendOperatorReply(id, "Ответ", randomUUID());
    expect(result).toMatchObject({ status: "failed" });
    expect(result.error).toContain("403");
    expect((await client()).bot_blocked).toBe(true);

    updateId += 1;
    await deliver({ update_id: updateId, my_chat_member: { chat, from: user, date: 1, old_chat_member: { status: "kicked" }, new_chat_member: { status: "member" } } });
    expect((await client()).bot_blocked).toBe(false);
    expect(await repo.retryChatMessage(id, result.messageId!, false)).toMatchObject({ status: "sent" });
  });

  it("блокировка бота пользователем (my_chat_member kicked)", async () => {
    await deliver(text("/start"));
    updateId += 1;
    await deliver({ update_id: updateId, my_chat_member: { chat, from: user, date: 1, old_chat_member: { status: "member" }, new_chat_member: { status: "kicked" } } });
    expect((await client()).bot_blocked).toBe(true);
    calls = [];
    const result = await repo.sendOperatorReply(String((await client()).id), "Ответ", randomUUID());
    expect(result.status).toBe("failed");
    expect(sends()).toHaveLength(0);
  });

  it("неизвестный результат отправки — повтор только с подтверждением", async () => {
    await deliver(text("/start"));
    const id = String((await client()).id);
    failNext = "unknown";
    const result = await repo.sendOperatorReply(id, "Ответ", randomUUID());
    expect(result.status).toBe("unknown");
    expect(await repo.retryChatMessage(id, result.messageId!, false)).toMatchObject({ status: "skipped" });
    expect(await repo.retryChatMessage(id, result.messageId!, true)).toMatchObject({ status: "sent" });
  });

  it("единый список: фильтр по каналу и поиск; ручная связь карточек разных каналов", async () => {
    await deliver(text("/start"));
    const tg = String((await client()).id);
    const max = (await db.query<{ id: string }>("INSERT INTO chat_clients (channel, external_user_id, first_name) VALUES ('max', 777, 'Мария') RETURNING id"))[0]!.id;
    const base = { q: "", filter: "" as const, period: "" as const, page: 1 };
    expect((await repo.listChatClients({ ...base, channel: "telegram" })).items.map((c) => c.channel)).toEqual(["telegram"]);
    expect((await repo.listChatClients({ ...base, channel: "" })).total).toBe(2);
    expect((await repo.listChatClients({ ...base, channel: "", q: "m_orlova" })).total).toBe(1);

    // Совпадение имени не объединяет карточки автоматически.
    expect(await repo.listLinkedClients(tg)).toEqual([]);
    expect((await repo.searchLinkCandidates(tg, "Мария")).map((c) => c.id)).toEqual([max]);
    expect(await repo.linkChatClients(tg, max)).toBe(true);
    expect((await repo.listLinkedClients(tg)).map((c) => c.id)).toEqual([max]);
    expect((await repo.listLinkedClients(max)).map((c) => c.id)).toEqual([tg]);
    // Переписка и данные остаются в своих карточках.
    expect((await db.query("SELECT id FROM chat_messages WHERE client_id = $1", [max])).length).toBe(0);
    await repo.unlinkChatClient(max);
    expect(await repo.listLinkedClients(tg)).toEqual([]);
    expect((await db.query<{ person_id: string | null }>("SELECT person_id FROM chat_clients WHERE id = $1", [tg]))[0]!.person_id).toBeNull();
  });
});
