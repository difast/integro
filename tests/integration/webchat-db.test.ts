import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Онлайн-чат на сайте с базой PostgreSQL (TEST_DATABASE_URL): сессии, дубли, видимость, ответы оператора, уведомления. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

let db: typeof import("@/lib/db");
let web: typeof import("@/lib/webchat/service");
let chat: typeof import("@/lib/chat/repository");

const post = (token: string | null, text: string, key = randomUUID(), consent = true) =>
  web.postVisitorMessage({ token, text, key, consent, consentRevision: "20.10.2026", source: "/uslugi/ocenka" });

async function newDialog(text = "Здравствуйте, нужна оценка") {
  const result = await post(null, text);
  if (!result.ok || !result.token) throw new Error("dialog not created");
  const session = (await web.findSession(result.token))!;
  return { token: result.token, session, message: result.message };
}

suite("веб-чат и база", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    web = await import("@/lib/webchat/service");
    chat = await import("@/lib/chat/repository");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE notifications, notification_deliveries, chat_messages, chat_notes, chat_events, requests, chat_clients RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await db?.closePool();
  });

  it("диалог создаётся только при первом сообщении и только с согласием; в базе хранится хеш токена", async () => {
    expect(await post(null, "Без согласия", randomUUID(), false)).toEqual({ ok: false, reason: "consent" });
    expect(await db.query("SELECT id FROM chat_clients")).toHaveLength(0);
    const { token, session, message } = await newDialog();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(message).toMatchObject({ from: "visitor", text: "Здравствуйте, нужна оценка" });
    const [row] = await db.query<Record<string, unknown>>("SELECT * FROM chat_clients WHERE id = $1", [session.clientId]);
    expect(row).toMatchObject({ channel: "web", mode: "operator", status: "open", needs_reply: true, source: "/uslugi/ocenka", consent_revision: "20.10.2026" });
    expect(row!.web_session_hash).toBe(web.hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    // Без cookie или с чужим/подделанным токеном сессии нет.
    expect(await web.findSession(null)).toBeNull();
    expect(await web.findSession("x".repeat(43))).toBeNull();
    expect(await web.findSession(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`)).toBeNull();
  });

  it("повтор с тем же ключом не создаёт дубль; ключ чужого диалога не раскрывает его", async () => {
    const { token, session } = await newDialog();
    const key = randomUUID();
    const first = await post(token, "Второе сообщение", key);
    const again = await post(token, "Второе сообщение", key);
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.duplicate).toBe(true);
    expect(again.message.id).toBe(first.message.id);
    expect((await db.query("SELECT id FROM chat_messages WHERE client_id = $1", [session.clientId])).length).toBe(2);

    const other = await newDialog("Другой посетитель");
    expect(await post(other.token, "Попытка", key)).toEqual({ ok: false, reason: "conflict" });
  });

  it("посетитель видит только свой диалог; ответы — только подтверждённые; заметки — никогда", async () => {
    const a = await newDialog("Сообщение A");
    const b = await newDialog("Сообщение B");
    await chat.addChatNote(a.session.clientId, "Внутренняя заметка: перезвонить");
    await db.query("INSERT INTO chat_messages (client_id, direction, author, kind, text, status) VALUES ($1, 'out', 'operator', 'text', 'Черновик в очереди', 'pending')", [a.session.clientId]);
    await db.query("INSERT INTO chat_messages (client_id, direction, author, kind, text, status) VALUES ($1, 'out', 'operator', 'text', 'Ошибка', 'failed')", [a.session.clientId]);
    const reply = await chat.sendOperatorReply(a.session.clientId, "Добрый день! Чем помочь?", randomUUID());
    expect(reply.status).toBe("sent");

    const forA = await web.getVisitorUpdates(a.session, { after: null, since: null, before: null });
    expect(forA.messages.map((m) => [m.from, m.text])).toEqual([
      ["visitor", "Сообщение A"],
      ["consultant", "Добрый день! Чем помочь?"],
    ]);
    expect(JSON.stringify(forA)).not.toContain("Внутренняя заметка");
    const forB = await web.getVisitorUpdates(b.session, { after: null, since: null, before: null });
    expect(forB.messages.map((m) => m.text)).toEqual(["Сообщение B"]);
    expect(forA.unread).toBe(1);
    await web.markVisitorRead(a.session);
    expect((await web.getVisitorUpdates(a.session, { after: null, since: null, before: null })).unread).toBe(0);
    // Ответ оператора снимает «нужен ответ» и считает входящие прочитанными.
    const [client] = await db.query<{ needs_reply: boolean; operator_read_at: Date | null }>("SELECT needs_reply, operator_read_at FROM chat_clients WHERE id = $1", [a.session.clientId]);
    expect(client).toMatchObject({ needs_reply: false });
    expect(client!.operator_read_at).not.toBeNull();
  });

  it("курсор: ответ, ставший видимым позже, приходит даже с меньшим id; повтор запроса без дублей", async () => {
    const { token, session } = await newDialog();
    const initial = await web.getVisitorUpdates(session, { after: null, since: null, before: null });
    const after = initial.messages.at(-1)!.id;
    // Ответ попал в очередь раньше нового сообщения посетителя, а показан — позже.
    const [queued] = await db.query<{ id: string }>(
      "INSERT INTO chat_messages (client_id, direction, author, kind, text, status) VALUES ($1, 'out', 'operator', 'text', 'Ответ из очереди', 'pending') RETURNING id",
      [session.clientId],
    );
    await post(token, "Ещё вопрос");
    const mid = await web.getVisitorUpdates(session, { after, since: initial.serverTime, before: null });
    expect(mid.messages.map((m) => m.text)).toEqual(["Ещё вопрос"]);
    await db.query("UPDATE chat_messages SET status = 'sent', sent_at = now() WHERE id = $1", [queued!.id]);
    const late = await web.getVisitorUpdates(session, { after: mid.messages.at(-1)!.id, since: mid.serverTime, before: null });
    expect(late.messages.map((m) => m.text)).toEqual(["Ответ из очереди"]);
    // Повтор того же запроса (переподключение) не теряет сообщения, дубли отбрасываются виджетом по id.
    const replay = await web.getVisitorUpdates(session, { after, since: initial.serverTime, before: null });
    expect(replay.messages.map((m) => m.id).sort()).toEqual([...mid.messages, ...late.messages].map((m) => m.id).sort());
  });

  it("история листается страницами", async () => {
    const { token, session } = await newDialog("Сообщение 0");
    for (let i = 1; i <= 60; i++) await post(token, `Сообщение ${i}`);
    const page = await web.getVisitorUpdates(session, { after: null, since: null, before: null });
    expect(page.messages).toHaveLength(web.WEBCHAT_PAGE);
    expect(page.hasMore).toBe(true);
    expect(page.messages.at(-1)!.text).toBe("Сообщение 60");
    const earlier = await web.getVisitorUpdates(session, { after: null, since: null, before: page.messages[0]!.id });
    expect(earlier.messages).toHaveLength(11);
    expect(earlier.messages[0]!.text).toBe("Сообщение 0");
    expect(earlier.hasMore).toBe(false);
  });

  it("«печатает» — только по сигналу оператора и только в веб-чате, истекает и снимается ответом", async () => {
    const { session } = await newDialog();
    expect((await web.getVisitorUpdates(session, { after: null, since: null, before: null })).typing).toBe(false);
    expect(await web.setOperatorTyping(session.clientId, true)).toBe(true);
    expect((await web.getVisitorUpdates(session, { after: null, since: null, before: null })).typing).toBe(true);
    await db.query("UPDATE chat_clients SET operator_typing_until = now() - interval '1 second' WHERE id = $1", [session.clientId]);
    expect((await web.getVisitorUpdates(session, { after: null, since: null, before: null })).typing).toBe(false);
    await web.setOperatorTyping(session.clientId, true);
    await chat.sendOperatorReply(session.clientId, "Ответ", randomUUID());
    expect((await web.getVisitorUpdates(session, { after: null, since: null, before: null })).typing).toBe(false);
    // Для MAX/Telegram сигнал не принимается.
    const [tg] = await db.query<{ id: string }>("INSERT INTO chat_clients (channel, external_user_id, first_name) VALUES ('telegram', 1, 'А') RETURNING id");
    expect(await web.setOperatorTyping(tg!.id, true)).toBe(false);
  });

  it("уведомления: новое сообщение и «нужен ответ» — без дублей; закрытый диалог открывается снова, опрос не планируется", async () => {
    const { token, session } = await newDialog();
    await post(token, "Ещё одно");
    const types = (await db.query<{ type: string; channel: string }>("SELECT type, channel FROM notifications ORDER BY id")).map((n) => `${n.type}:${n.channel}`);
    expect(types).toEqual(["message:web", "needs_reply:web"]);
    // Закрытие: опрос после закрытия в веб-чате не планируется (кнопок в виджете нет).
    await chat.updateChatClient(session.clientId, { status: "closed" });
    const [closed] = await db.query<{ status: string; survey_due_at: Date | null }>("SELECT status, survey_due_at FROM chat_clients WHERE id = $1", [session.clientId]);
    expect(closed).toEqual({ status: "closed", survey_due_at: null });
    expect((await web.findSession(token))!.status).toBe("closed");
    await post(token, "Вернулся с вопросом");
    expect((await web.findSession(token))!.status).toBe("open");
  });

  it("истёкшая сессия не восстанавливает диалог; список админки показывает непрочитанные", async () => {
    const { token, session } = await newDialog();
    await post(token, "Второе");
    const list = await chat.listChatClients({ q: "", filter: "", period: "", channel: "web", page: 1 });
    expect(list.items[0]).toMatchObject({ channel: "web", unreadCount: 2 });
    await chat.markOperatorRead(session.clientId);
    expect((await chat.listChatClients({ q: "", filter: "", period: "", channel: "web", page: 1 })).items[0]!.unreadCount).toBe(0);
    expect((await chat.listChatClients({ q: "", filter: "new", period: "", channel: "web", page: 1 })).total).toBe(1);
    await db.query("UPDATE chat_clients SET web_session_expires_at = now() - interval '1 minute' WHERE id = $1", [session.clientId]);
    expect(await web.findSession(token)).toBeNull();
  });
});
