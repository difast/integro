import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Уведомления, мониторинг, резервные копии, история заявки и аналитика — с базой PostgreSQL (TEST_DATABASE_URL). */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const pushCalls: { endpoint: string; payload: string }[] = [];
let pushFail: number | null = null;
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (pushFail) {
        const status = pushFail;
        pushFail = null;
        throw Object.assign(new Error("push failed"), { statusCode: status, headers: {} });
      }
      pushCalls.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    },
  },
}));

type Db = typeof import("@/lib/db");
type Api = typeof import("@/lib/telegram/api");
let db: Db;
let api: Api;
let processor: typeof import("@/lib/chat/processor");
let service: typeof import("@/lib/notifications/service");
let delivery: typeof import("@/lib/notifications/delivery");
let link: typeof import("@/lib/notifications/telegram-link");
let requests: typeof import("@/lib/requests/repository");
let history: typeof import("@/lib/requests/history");
let analytics: typeof import("@/lib/analytics/repository");
let filters: typeof import("@/lib/analytics/filters");
let backup: typeof import("@/lib/backup/format");
let retention: typeof import("@/lib/ops/retention");

type Call = { method: string; params: Record<string, unknown> };
let calls: Call[] = [];
let tgFail: "403" | "429" | null = null;
let updateId = 9000;
let messageId = 100;

const staff = { id: 777001, is_bot: false, first_name: "Сотрудник", username: "staff_integro" };
function start(payload: string, from = staff) {
  updateId += 1;
  messageId += 1;
  return { update_id: updateId, message: { message_id: messageId, from, chat: { id: from.id, type: "private" }, date: Math.floor(Date.now() / 1000), text: `/start ${payload}` } };
}
async function deliver(update: unknown) {
  const stored = await processor.storeEvent("telegram", update);
  if (stored && !stored.duplicate) await processor.processEvent(stored.id);
  return stored;
}

const PHONE = "+7 900 123-45-67";
async function newRequest(extra: Partial<import("@/lib/requests/repository").NewRequest> = {}) {
  const { id } = await requests.createRequest({
    submissionKey: randomUUID(),
    name: "Клиент Тестовый",
    phone: PHONE,
    email: "",
    service: "ocenka",
    serviceTitle: "Оценка",
    message: "Нужна оценка квартиры",
    sourcePage: null,
    context: null,
    consentRevision: "test",
    ...extra,
  });
  return id;
}
const work = (patch: Partial<import("@/lib/requests/repository").RequestWorkChanges>): import("@/lib/requests/repository").RequestWorkChanges => ({
  status: "in_progress",
  notes: "",
  stage: "request",
  lossReasonId: null,
  lossComment: null,
  assignee: null,
  channel: "site",
  sourceNote: null,
  dealAmount: null,
  currency: "RUB",
  contractDate: null,
  paymentStatus: "none",
  paidAmount: null,
  paidAt: null,
  directionId: null,
  ...patch,
});

suite("CRM: уведомления, мониторинг, копии, аналитика", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAE_integration-token-0123456789ab";
    process.env.TELEGRAM_WEBHOOK_SECRET = "w".repeat(40);
    process.env.TELEGRAM_BOT_USERNAME = "IntegroTestBot";
    process.env.VAPID_PUBLIC_KEY = "B".repeat(87);
    process.env.VAPID_PRIVATE_KEY = "p".repeat(43);
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    db = await import("@/lib/db");
    api = await import("@/lib/telegram/api");
    processor = await import("@/lib/chat/processor");
    service = await import("@/lib/notifications/service");
    delivery = await import("@/lib/notifications/delivery");
    link = await import("@/lib/notifications/telegram-link");
    requests = await import("@/lib/requests/repository");
    history = await import("@/lib/requests/history");
    analytics = await import("@/lib/analytics/repository");
    filters = await import("@/lib/analytics/filters");
    backup = await import("@/lib/backup/format");
    retention = await import("@/lib/ops/retention");
    await db.ensureSchema();
    api.setTelegramTransport(async (_config, method, params) => {
      calls.push({ method, params });
      if (tgFail && method === "sendMessage") {
        // 429 повторяется на всех попытках: внутренний повтор клиента API тоже получает отказ.
        if (tgFail === "403") {
          tgFail = null;
          throw new api.TelegramApiError("http", "Forbidden: bot was blocked by the user", 403);
        }
        throw new api.TelegramApiError("http", "Too Many Requests", 429, null, 5);
      }
      if (method === "sendMessage") return { message_id: ++messageId, chat: { id: params.chat_id }, date: 1 };
      if (method === "getMe") return { id: 1, is_bot: true, first_name: "Bot", username: "IntegroTestBot" };
      return true;
    });
  });

  beforeEach(async () => {
    calls = [];
    pushCalls.length = 0;
    tgFail = null;
    pushFail = null;
    await db.query(
      `TRUNCATE notifications, notification_deliveries, push_subscriptions, notification_recipients, admin_link_codes, system_events,
        integration_status, app_settings, request_history, chat_messages, chat_notes, chat_events, requests, chat_clients RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    api?.setTelegramTransport(null);
    await db?.closePool();
  });

  it("уведомление создаётся один раз на событие, доставки — по каждому каналу и получателю", async () => {
    await db.query("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example/a', 'k', 'a'), ('https://push.example/b', 'k', 'a')");
    await db.query("INSERT INTO notification_recipients (chat_id, display_name) VALUES (777001, 'Сотрудник'), (777002, 'Отключён')");
    await db.query("UPDATE notification_recipients SET active = false WHERE chat_id = 777002");
    const input = { type: "request_site" as const, channel: "site", title: "Новая заявка № 1 · Клиент Тестовый", body: PHONE, link: "/admin/zayavki/x", dedupeKey: "request:x" };
    expect(await service.notify(input)).not.toBeNull();
    expect(await service.notify(input)).toBeNull();
    const rows = await db.query<{ transport: string }>("SELECT transport FROM notification_deliveries ORDER BY id");
    expect(rows.map((r) => r.transport)).toEqual(["push", "push", "telegram"]);

    expect(await delivery.deliverPendingNotifications()).toBe(3);
    expect(pushCalls).toHaveLength(2);
    const tg = calls.filter((c) => c.method === "sendMessage");
    expect(tg).toHaveLength(1);
    // Во внешние сервисы не уходят имя, телефон и текст из уведомления.
    for (const text of [...pushCalls.map((p) => p.payload), String(tg[0]!.params.text)]) {
      expect(text).not.toContain("Клиент Тестовый");
      expect(text).not.toContain("900");
    }
    const summary = await service.notificationSummary();
    expect(summary.unread).toBe(1);
    expect(await service.markNotificationsRead("all")).toBe(1);
    expect((await service.notificationSummary()).unread).toBe(0);
  });

  it("сообщения одного диалога объединяются ключом с интервалом", async () => {
    const t = Date.UTC(2026, 9, 20, 10, 0);
    expect(await service.throttledKey("message:c1", t)).toBe(await service.throttledKey("message:c1", t + 5 * 60_000));
    expect(await service.throttledKey("message:c1", t)).not.toBe(await service.throttledKey("message:c1", t + 16 * 60_000));
  });

  it("push 410 удаляет подписку; Telegram 403 отключает получателя; 429 — повтор позже", async () => {
    await db.query("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example/gone', 'k', 'a')");
    await db.query("INSERT INTO notification_recipients (chat_id) VALUES (777001)");
    pushFail = 410;
    tgFail = "403";
    await service.notify({ type: "needs_reply", channel: "max", title: "Нужен ответ", dedupeKey: "nr:1" });
    await delivery.deliverPendingNotifications();
    expect(await db.query("SELECT id FROM push_subscriptions")).toHaveLength(0);
    expect((await db.query<{ active: boolean }>("SELECT active FROM notification_recipients"))[0]!.active).toBe(false);
    expect((await db.query<{ status: string }>("SELECT status FROM notification_deliveries ORDER BY id")).map((r) => r.status)).toEqual(["skipped", "skipped"]);

    await db.query("UPDATE notification_recipients SET active = true");
    tgFail = "429";
    await service.notify({ type: "needs_reply", channel: "max", title: "Нужен ответ", dedupeKey: "nr:2" });
    await delivery.deliverPendingNotifications();
    const retry = (await db.query<{ status: string; wait: number }>(
      "SELECT status, extract(epoch FROM next_attempt_at - now())::int AS wait FROM notification_deliveries WHERE status <> 'skipped'",
    ))[0]!;
    expect(retry.status).toBe("pending");
    expect(calls.filter((c) => c.method === "sendMessage")).toHaveLength(4); // 1 (403) + 3 попытки внутри клиента API
    expect(retry.wait).toBeGreaterThan(30);
    const status = await db.query<{ last_error: string | null }>("SELECT last_error FROM integration_status WHERE key = 'telegram_admin:notify'");
    expect(status[0]?.last_error).toContain("Too Many Requests");
  });

  it("привязка Telegram: действующий код подключает получателя без карточки клиента; повтор и чужой код отклоняются", async () => {
    const { url: linkUrl } = await link.createTelegramLink();
    const code = linkUrl.split("start=admin_")[1]!;
    expect(code).toMatch(/^[a-f0-9]{32}$/);
    expect((await db.query<{ code_hash: string }>("SELECT code_hash FROM admin_link_codes"))[0]!.code_hash).not.toBe(code);

    await deliver(start(`admin_${code}`));
    expect((await link.listRecipients()).map((r) => r.chatId)).toEqual(["777001"]);
    expect(await db.query("SELECT id FROM chat_clients")).toHaveLength(0);
    expect(String(calls.find((c) => c.method === "sendMessage")?.params.text)).toMatch(/подключ/i);

    const stranger = { id: 777099, is_bot: false, first_name: "Посторонний", username: "x" };
    await deliver(start(`admin_${code}`, stranger));
    await deliver(start(`admin_${"0".repeat(32)}`, stranger));
    expect((await link.listRecipients()).map((r) => r.chatId)).toEqual(["777001"]);

    await db.query("INSERT INTO admin_link_codes (code_hash, expires_at) VALUES (encode(sha256('ffffffffffffffffffffffffffffffff'), 'hex'), now() - interval '1 minute')");
    await deliver(start(`admin_${"f".repeat(32)}`, stranger));
    expect(await link.listRecipients()).toHaveLength(1);
  });

  it("сбой обработки события: повторы с растущим интервалом, после 5 попыток — уведомление и запись в журнал", async () => {
    await db.query(`CREATE OR REPLACE FUNCTION test_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$ LANGUAGE plpgsql`);
    await db.query("CREATE TRIGGER test_fail BEFORE INSERT ON chat_clients FOR EACH ROW EXECUTE FUNCTION test_fail()");
    try {
      const client = { id: 555777, is_bot: false, first_name: "Клиент" };
      updateId += 1;
      const stored = await processor.storeEvent("telegram", { update_id: updateId, message: { message_id: 1, from: client, chat: { id: client.id, type: "private" }, date: 1, text: "Здравствуйте" } });
      for (let i = 1; i <= 5; i++) {
        await processor.processEvent(stored!.id);
        const event = (await db.query<{ status: string; attempts: number; wait: number }>(
          "SELECT status, attempts, round(extract(epoch FROM next_attempt_at - now()) / 60)::int AS wait FROM chat_events WHERE id = $1",
          [stored!.id],
        ))[0]!;
        expect(event).toMatchObject({ status: "failed", attempts: i, wait: 2 ** (i - 1) });
        const failed = await db.query("SELECT id FROM notifications WHERE type = 'processing_failed'");
        expect(failed).toHaveLength(i === 5 ? 1 : 0);
      }
      await processor.processEvent(stored!.id); // попытки исчерпаны — событие больше не обрабатывается
      expect((await db.query<{ attempts: number }>("SELECT attempts FROM chat_events WHERE id = $1", [stored!.id]))[0]!.attempts).toBe(5);
      const journal = await db.query<{ result: string }>("SELECT result FROM system_events WHERE operation = 'process_event' ORDER BY id");
      expect(journal.map((r) => r.result)).toEqual(["retry", "retry", "retry", "retry", "failed"]);
    } finally {
      await db.query("DROP TRIGGER IF EXISTS test_fail ON chat_clients");
    }
  });

  it("история заявки: создание и каждое изменённое поле", async () => {
    const id = await newRequest();
    await history.recordRequestCreated(id, "site");
    const price = (await requests.listLossReasons()).find((r) => r.title === "Цена")!;
    await requests.updateRequestWork(id, work({ stage: "negotiation", assignee: "Иванов", dealAmount: "150000.00" }));
    await requests.updateRequestWork(id, work({ stage: "lost", assignee: "Иванов", dealAmount: "150000.00", lossReasonId: price.id, status: "rejected" }));
    const rows = await history.listRequestHistory(id);
    const stages = rows.filter((r) => r.field === "stage").map((r) => [r.oldValue, r.newValue]);
    expect(rows[0]).toMatchObject({ field: "created", actor: "site" });
    expect(stages).toEqual([
      ["request", "negotiation"],
      ["negotiation", "lost"],
    ]);
    expect(rows.filter((r) => r.field === "assignee")).toHaveLength(1);
    expect(rows.some((r) => r.field === "notes")).toBe(false);
  });

  it("аналитика: показатели на известном наборе данных", async () => {
    const [tg1] = await db.query<{ id: string }>("INSERT INTO chat_clients (channel, external_user_id, first_name, qualified_at) VALUES ('telegram', 1, 'А', now()) RETURNING id");
    await db.query("INSERT INTO chat_clients (channel, external_user_id, first_name, needs_reply) VALUES ('telegram', 2, 'Б', true)");
    const [mx] = await db.query<{ id: string }>("INSERT INTO chat_clients (channel, external_user_id, first_name) VALUES ('max', 3, 'В') RETURNING id");
    await db.query(
      `INSERT INTO chat_messages (client_id, direction, author, kind, text, status, created_at) VALUES
        ($1, 'in', 'client', 'text', 'Здравствуйте', 'received', now() - interval '30 minutes'),
        ($1, 'out', 'operator', 'text', 'Добрый день', 'sent', now() - interval '20 minutes')`,
      [tg1!.id],
    );
    const price = (await requests.listLossReasons()).find((r) => r.title === "Цена")!;
    const a = await newRequest();
    await requests.updateRequestWork(a, work({ stage: "won", dealAmount: "100000.00", paymentStatus: "partial", paidAmount: "50000.00", paidAt: "2026-10-01" }));
    const b = await newRequest({ phone: "+7 900 000-00-01" });
    await requests.updateRequestWork(b, work({ stage: "negotiation" }));
    await requests.updateRequestWork(b, work({ stage: "lost", lossReasonId: price.id }));
    const c = await newRequest({ channel: "whatsapp", phone: "" });
    await requests.updateRequestWork(c, work({ stage: "negotiation", channel: "whatsapp" }));
    await newRequest({ channel: "max", chatClientId: mx!.id });

    const today = filters.moscowToday();
    const f = filters.parseAnalyticsFilters({ from: today, to: today });
    const report = await analytics.getAnalyticsReport(f);
    expect(report.dialogs).toMatchObject({ total: 3, uniquePeople: 3, qualified: 2, withRequest: 1, unanswered: 1 });
    expect(report.dialogs!.firstReply).toMatchObject({ count: 1, medianSeconds: 600 });
    expect(report.requests).toMatchObject({ total: 4, withoutDialog: 3, uniquePhones: 2, withoutPhone: 1, negotiation: 3, priced: 1, won: 1, lost: 1 });
    expect(report.funnel.map((s) => s.count)).toEqual([6, 5, 4, 3, 1, 1, 1]);
    expect(report.money).toEqual([{ currency: "RUB", paid: 50000, paidCount: 1, contract: 100000, contractCount: 1, averageCheck: 100000 }]);
    expect(report.lossReasons).toEqual([{ title: "Цена", count: 1 }]);
    expect(report.conversions.find((x) => x.key === "win_rate")!.ratio).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
    expect(report.channels.map((ch) => [ch.channel, ch.dialogs, ch.requests])).toEqual([
      ["site", null, 2],
      ["max", 1, 1],
      ["telegram", 2, 0],
      ["whatsapp", null, 1],
    ]);

    const wa = await analytics.getAnalyticsReport({ ...f, channel: "whatsapp" });
    expect(wa.dialogs).toBeNull();
    expect(wa.requests.total).toBe(1);
    const lost = await analytics.getAnalyticsReport({ ...f, lossReason: price.id });
    expect(lost.requests.total).toBe(1);
    const yesterday = await analytics.getAnalyticsReport(filters.parseAnalyticsFilters({ from: "2020-01-01", to: "2020-01-02" }));
    expect(yesterday.requests.total).toBe(0);
    expect(yesterday.dialogs!.total).toBe(0);
    const rows = await analytics.listAnalyticsRequests(f);
    expect(rows).toHaveLength(4);
    expect(Object.keys(rows[0]!)).not.toContain("phone");
  });

  it("резервная копия: выгрузка и восстановление в отдельную базу с теми же данными", async () => {
    const id = await newRequest();
    await requests.updateRequestWork(id, work({ stage: "won", dealAmount: "12345.67" }));
    await service.notify({ type: "system", channel: "system", title: "Проверка", dedupeKey: "bk:1" });
    const { Client } = await import("pg");
    const source = new Client({ connectionString: url });
    await source.connect();
    const dump = await backup.runDump(source);
    await source.end();
    expect(dump.rows).toBeGreaterThan(5);

    const targetUrl = url!.replace(/\/[^/?]+(\?|$)/, "/integro_restore_test$1");
    const target = new Client({ connectionString: targetUrl });
    await target.connect();
    try {
      const result = await backup.restoreTables(target, dump.data);
      expect(result.rows).toBe(dump.rows);
      const restored = await target.query<{ deal_amount: string; stage: string }>("SELECT deal_amount::text, stage FROM requests WHERE id = $1", [id]);
      expect(restored.rows[0]).toEqual({ deal_amount: "12345.67", stage: "won" });
      const hist = await target.query("SELECT id FROM request_history WHERE request_id = $1", [id]);
      expect(hist.rows.length).toBeGreaterThan(0);
      // Новые записи продолжают нумерацию после восстановленных.
      const next = await target.query<{ id: string }>("INSERT INTO system_events (channel, operation, result) VALUES ('system', 'check', 'ok') RETURNING id");
      const max = await target.query<{ max: string | null }>("SELECT max(id) AS max FROM system_events");
      expect(next.rows[0]!.id).toBe(max.rows[0]!.max);
      // Повреждённая копия: восстановление откатывается, данные остаются.
      await expect(backup.restoreTables(target, Buffer.from("broken"))).rejects.toThrow();
      expect((await target.query("SELECT id FROM requests WHERE id = $1", [id])).rows).toHaveLength(1);
    } finally {
      await target.end();
    }
  });

  it("сроки хранения: служебные записи очищаются, заявки — только при заданном сроке", async () => {
    const id = await newRequest();
    await db.query("UPDATE requests SET status = 'done', updated_at = now() - interval '400 days' WHERE id = $1", [id]);
    await db.query("INSERT INTO notifications (type, channel, title, dedupe_key, created_at) VALUES ('system', 'system', 'old', 'old', now() - interval '100 days')");
    expect(await retention.runRetention()).toEqual({ chats: 0, requests: 0 });
    expect(await db.query("SELECT id FROM notifications")).toHaveLength(0);
    expect(await db.query("SELECT id FROM requests")).toHaveLength(1);
    await retention.saveRetentionSettings({ chatDays: null, requestDays: 365 });
    expect(await retention.runRetention()).toEqual({ chats: 0, requests: 1 });
  });
});
