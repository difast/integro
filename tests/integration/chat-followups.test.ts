import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Автоматические сообщения спустя время (MAX и Telegram) с базой TEST_DATABASE_URL и имитацией API. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
let db: Db;
let processor: typeof import("@/lib/chat/processor");
let repo: typeof import("@/lib/chat/repository");
let maxApi: typeof import("@/lib/max/api");
let tgApi: typeof import("@/lib/telegram/api");

type Sent = { channel: string; text: string; buttons: string[] };
let sent: Sent[] = [];
let n = 9000;

const tgUser = { id: 610001, is_bot: false, first_name: "Илья" };
const maxUser = { user_id: 610002, first_name: "Олег", is_bot: false };

const tgText = (text: string) => ({ update_id: ++n, message: { message_id: ++n, from: tgUser, chat: { id: tgUser.id, type: "private" }, date: Math.floor(Date.now() / 1000), text } });
const tgPress = (data: string) => ({ update_id: ++n, callback_query: { id: `q${++n}`, from: tgUser, data, message: { message_id: 1, chat: { id: tgUser.id, type: "private" }, date: 1, text: "x" } } });
const maxPress = (payload: string) => ({
  update_type: "message_callback",
  timestamp: Date.now() + ++n,
  callback: { callback_id: `c${n}`, payload, user: maxUser, timestamp: 1 },
  message: { recipient: { chat_type: "dialog", chat_id: 1 }, body: { mid: `m${n}`, text: "x" } },
});
const maxText = (text: string) => ({
  update_type: "message_created",
  timestamp: Date.now() + ++n,
  message: { sender: maxUser, recipient: { chat_id: 1, chat_type: "dialog" }, body: { mid: `in${n}`, text } },
});

async function deliver(channel: "max" | "telegram", update: unknown) {
  const stored = await processor.storeEvent(channel, update);
  if (stored && !stored.duplicate) await processor.processEvent(stored.id);
}
const clientId = async (channel: string) => String((await db.query<{ id: string }>("SELECT id FROM chat_clients WHERE channel = $1", [channel]))[0]!.id);
/** «Перевести часы»: последняя активность клиента — столько часов назад. */
const ago = (channel: string, hours: number) =>
  db.query("UPDATE chat_clients SET last_seen_at = now() - make_interval(mins => $2) WHERE channel = $1", [channel, Math.round(hours * 60)]);

suite("автоматические сообщения спустя время", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.MAX_BOT_TOKEN = "followup-token";
    process.env.MAX_WEBHOOK_SECRET = "f".repeat(40);
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAE_followup-token-0123456789abcd";
    process.env.TELEGRAM_WEBHOOK_SECRET = "g".repeat(40);
    db = await import("@/lib/db");
    processor = await import("@/lib/chat/processor");
    repo = await import("@/lib/chat/repository");
    maxApi = await import("@/lib/max/api");
    tgApi = await import("@/lib/telegram/api");
    await db.ensureSchema();
    maxApi.setMaxTransport(async (_c, options) => {
      if (options.path === "messages") {
        const body = options.body as { text: string; attachments?: { payload: { buttons: { text: string }[][] } }[] };
        sent.push({ channel: "max", text: body.text, buttons: body.attachments?.[0]?.payload.buttons.flat().map((b) => b.text) ?? [] });
        return { message: { body: { mid: `out${++n}` } } };
      }
      return { success: true };
    });
    tgApi.setTelegramTransport(async (_c, method, params) => {
      if (method === "sendMessage") {
        const markup = params.reply_markup as { inline_keyboard?: { text: string }[][] } | undefined;
        sent.push({ channel: "telegram", text: String(params.text), buttons: markup?.inline_keyboard?.flat().map((b) => b.text) ?? [] });
        return { message_id: ++n, chat: { id: params.chat_id }, date: 1 };
      }
      return true;
    });
  });

  beforeEach(async () => {
    sent = [];
    await db.query("TRUNCATE chat_messages, chat_notes, chat_events, requests, chat_clients RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    maxApi?.setMaxTransport(null);
    tgApi?.setTelegramTransport(null);
    await db?.closePool();
  });

  async function startApplication(channel: "max" | "telegram") {
    if (channel === "telegram") {
      for (const u of [tgText("/start"), tgPress("apply"), tgPress("consent:yes"), tgText("Илья")]) await deliver("telegram", u);
    } else {
      for (const u of [maxText("меню"), maxPress("apply"), maxPress("consent:yes"), maxText("Олег")]) await deliver("max", u);
    }
    sent = [];
  }

  for (const channel of ["telegram", "max"] as const) {
    it(`${channel}: напоминание через 2 часа и последнее через 24 часа, не раньше и не повторно`, async () => {
      await startApplication(channel);
      await ago(channel, 1);
      await processor.runFollowUps();
      expect(sent).toHaveLength(0);

      await ago(channel, 2.1);
      await processor.runFollowUps();
      await processor.runFollowUps();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ channel, buttons: ["Продолжить заявку", "Отменить"] });
      expect(sent[0]!.text).toContain("не закончили");

      await ago(channel, 23);
      await processor.runFollowUps();
      expect(sent).toHaveLength(1);
      await ago(channel, 24.1);
      await processor.runFollowUps();
      await processor.runFollowUps();
      expect(sent).toHaveLength(2);
      expect(sent[1]!.text).toContain("Больше напоминать не будем");

      await ago(channel, 72);
      await processor.runFollowUps();
      expect(sent).toHaveLength(2);
    });
  }

  it("«Продолжить заявку» повторяет вопрос текущего шага; ответ клиента сбрасывает напоминания", async () => {
    await startApplication("telegram");
    await ago("telegram", 3);
    await processor.runFollowUps();
    sent = [];
    await deliver("telegram", tgPress("resume"));
    expect(sent[0]!.text).toBe("Какое направление вас интересует?");
    const row = (await db.query<{ reminder_stage: number }>("SELECT reminder_stage FROM chat_clients"))[0]!;
    expect(row.reminder_stage).toBe(0);
  });

  it("напоминаний нет вне заявки, в режиме оператора и при заблокированном боте", async () => {
    await deliver("telegram", tgText("/start"));
    await ago("telegram", 5);
    await processor.runFollowUps();
    expect(sent.filter((s) => s.text.includes("не закончили"))).toHaveLength(0);

    await startApplication("telegram");
    const id = await clientId("telegram");
    await repo.updateChatClient(id, { mode: "operator" });
    await ago("telegram", 5);
    await processor.runFollowUps();
    expect(sent).toHaveLength(0);

    await db.query("UPDATE chat_clients SET mode = 'bot', bot_blocked = true");
    await processor.runFollowUps();
    expect(sent).toHaveLength(0);
  });

  for (const channel of ["telegram", "max"] as const) {
    it(`${channel}: опрос через 30 минут после закрытия; «Вопросов нет» — диалог остаётся закрытым`, async () => {
      await (channel === "telegram" ? deliver("telegram", tgText("Здравствуйте")) : deliver("max", maxText("Здравствуйте")));
      const id = await clientId(channel);
      await repo.updateChatClient(id, { status: "closed" });
      sent = [];
      await processor.runFollowUps();
      expect(sent).toHaveLength(0);

      await db.query("UPDATE chat_clients SET survey_due_at = now() - interval '1 minute' WHERE id = $1", [id]);
      await processor.runFollowUps();
      await processor.runFollowUps();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ channel, buttons: ["Вопросов нет", "Есть вопрос"] });

      sent = [];
      await (channel === "telegram" ? deliver("telegram", tgPress("survey:no")) : deliver("max", maxPress("survey:no")));
      expect(sent[0]!.text).toContain("Спасибо!");
      expect((await repo.getChatClient(id))!.status).toBe("closed");
    });
  }

  it("«Есть вопрос»: диалог возвращается в работу с отметкой «нужен ответ», следующие сообщения — специалисту", async () => {
    await deliver("telegram", tgText("Здравствуйте"));
    const id = await clientId("telegram");
    await repo.updateChatClient(id, { status: "closed" });
    await db.query("UPDATE chat_clients SET survey_due_at = now() - interval '1 minute'");
    await processor.runFollowUps();
    sent = [];
    await deliver("telegram", tgPress("survey:yes"));
    expect(sent[0]!.text).toContain("Напишите ваш вопрос");
    expect(await repo.getChatClient(id)).toMatchObject({ status: "open", needsReply: true });
    sent = [];
    await deliver("telegram", tgText("Сколько займёт экспертиза?"));
    expect(sent).toHaveLength(0);
  });

  it("опрос не отправляется, если диалог снова открыт или клиент написал до срока", async () => {
    await deliver("telegram", tgText("Здравствуйте"));
    const id = await clientId("telegram");
    await repo.updateChatClient(id, { status: "closed" });
    await repo.updateChatClient(id, { status: "open" });
    await db.query("UPDATE chat_clients SET survey_due_at = NULL");
    await processor.runFollowUps();
    expect(sent.filter((s) => s.text.includes("Остались ли"))).toHaveLength(0);

    await repo.updateChatClient(id, { status: "closed" });
    await deliver("telegram", tgText("Ещё вопрос"));
    expect((await db.query<{ survey_due_at: Date | null }>("SELECT survey_due_at FROM chat_clients"))[0]!.survey_due_at).toBeNull();
  });
});
