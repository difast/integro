import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD, E2E_TG_MOCK, E2E_TG_SECRET, E2E_TG_TOKEN } from "../../playwright.config";

/**
 * Telegram-бот от /start до ответа оператора: Webhook → база → админка → Bot API.
 * Вместо api.telegram.org — имитация (tests/e2e/telegram-mock-server.mjs), которая записывает запросы.
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });
const user = { id: 880001, is_bot: false, first_name: "Анна", last_name: "Смирнова", username: "anna_s" };
const chat = { id: 880001, type: "private" };
let updateId = Date.now();
let messageId = 1;

type MockRequest = { method: string; tokenOk: boolean; params: Record<string, unknown> };
const mockRequests = async (request: APIRequestContext): Promise<MockRequest[]> => (await request.get(`${E2E_TG_MOCK}/__requests`)).json();
const sentTexts = async (request: APIRequestContext) =>
  (await mockRequests(request)).filter((r) => r.method === "sendMessage").map((r) => String(r.params.text ?? ""));

const message = (text: string, from = user) => ({
  update_id: ++updateId,
  message: { message_id: ++messageId, from, chat: { id: from.id, type: "private" }, date: Math.floor(Date.now() / 1000), text },
});
// Отдельный клиент для сценария оператора — независимо от предыдущих тестов.
const operatorUser = { id: 880002, is_bot: false, first_name: "Анна", last_name: "Белова", username: "anna_belova" };
const press = (data: string) => ({ update_id: ++updateId, callback_query: { id: `cb${updateId}`, from: user, data, message: { message_id: 5, chat, date: 1, text: "Меню" } } });

const webhook = (request: APIRequestContext, data: unknown, secret: string | null = E2E_TG_SECRET) =>
  request.post("/api/telegram/webhook", { data, headers: secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {} });

async function login(page: Page) {
  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin$/);
}

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.chat_clients') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("DELETE FROM chat_clients WHERE channel = 'telegram'");
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context, request }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
  await request.post(`${E2E_TG_MOCK}/__reset`);
});

test("Webhook Telegram: секрет обязателен, повторная доставка Update не создаёт дубль", async ({ request }) => {
  const update = message("/start");
  expect((await webhook(request, update, null)).status()).toBe(401);
  expect((await webhook(request, update, "wrong-secret-wrong-secret-wrong-secret")).status()).toBe(401);
  expect((await webhook(request, update)).status()).toBe(200);
  expect((await webhook(request, update)).status()).toBe(200);

  await expect.poll(async () => (await sentTexts(request)).length).toBe(1);
  expect((await sentTexts(request))[0]).toContain("ООО «Интегро»");
  const all = await mockRequests(request);
  expect(all.every((r) => r.tokenOk)).toBe(true);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM chat_messages m JOIN chat_clients c ON c.id = m.client_id WHERE c.channel = 'telegram' AND m.direction = 'in'");
  expect(rows[0].n).toBe(1);
  // Сервер без настроенного бота события не принимает.
  expect((await request.post("http://localhost:3202/api/telegram/webhook", { data: update, headers: { "X-Telegram-Bot-Api-Secret-Token": E2E_TG_SECRET } })).status()).toBe(503);
});

test("кнопки меню отвечают разделами; заявка из Telegram попадает в «Заявки»", async ({ request, page }) => {
  for (const [payload, expected] of [
    ["sec:ocenka", "недвижимое имущество"],
    ["sec:sudeb", "землеустроительная"],
    ["sec:issled", "рецензирование"],
    ["specialist", "Передали ваш запрос специалисту"],
  ] as const) {
    await request.post(`${E2E_TG_MOCK}/__reset`);
    await webhook(request, press(payload));
    await expect.poll(async () => (await sentTexts(request)).join("\n")).toContain(expected);
  }

  await webhook(request, press("menu"));
  for (const update of [press("apply"), press("consent:yes"), message("Анна"), press("dir:sudeb"), message("Нужна экспертиза по делу о ДТП"), press("skip"), press("skip"), press("confirm")]) {
    await webhook(request, update);
    // События обрабатываются по порядку.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  await expect.poll(async () => (await sentTexts(request)).join("\n"), { timeout: 15_000 }).toMatch(/Заявка № [0-9A-F]{8} принята/);

  await login(page);
  const row = page.getByRole("row", { name: /Анна/ }).first();
  await expect(row).toContainText("Telegram");
  await expect(row).toContainText("Судебная экспертиза");
});

test("оператор отвечает из админки — сообщение уходит в Telegram и подтверждается", async ({ page, request }) => {
  await webhook(request, message("Добрый день, у меня вопрос по оценке доли", operatorUser));
  await expect.poll(async () => (await sentTexts(request)).length).toBeGreaterThan(0);

  await login(page);
  await page.getByRole("link", { name: "Обращения", exact: true }).click();
  await page.getByRole("link", { name: "Telegram", exact: true }).click();
  await expect(page).toHaveURL(/channel=telegram/);
  const card = page.getByRole("link", { name: /Анна Белова/ });
  await expect(card).toContainText(`ID ${operatorUser.id}`);
  await expect(card).toContainText("@anna_belova");
  await card.click();

  const dialog = page.getByRole("list", { name: "Сообщения по времени" });
  await expect(dialog).toContainText("вопрос по оценке доли");
  await request.post(`${E2E_TG_MOCK}/__reset`);
  await page.getByLabel("Ответ клиенту").fill("Здравствуйте, Анна! Уточните, пожалуйста, цель оценки.");
  await page.getByRole("button", { name: "Отправить в Telegram" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Telegram подтвердил отправку" })).toBeVisible();

  const sent = (await mockRequests(request)).filter((r) => r.method === "sendMessage");
  expect(sent).toHaveLength(1);
  expect(sent[0]!.params).toMatchObject({ chat_id: operatorUser.id, text: "Здравствуйте, Анна! Уточните, пожалуйста, цель оценки." });
  await expect(dialog).toContainText("Отправлено, платформа подтвердила");

  // Клиент отвечает — сообщение появляется в карточке, бот молчит.
  await request.post(`${E2E_TG_MOCK}/__reset`);
  await webhook(request, message("Для раздела имущества", operatorUser));
  await expect(dialog).toContainText("Для раздела имущества", { timeout: 15_000 });
  expect(await sentTexts(request)).toHaveLength(0);
});

test("настройки Telegram: переменные без значений, getMe и setWebhook через админку", async ({ page, request }) => {
  await login(page);
  await page.goto("/admin/obrashcheniya/nastroyki");
  const section = page.getByRole("region", { name: "Telegram" });
  await expect(section.getByText("TELEGRAM_BOT_TOKEN — задано")).toBeVisible();
  await expect(section.getByText("TELEGRAM_WEBHOOK_SECRET — задано")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain(E2E_TG_TOKEN);
  expect(html).not.toContain(E2E_TG_SECRET);

  await section.getByRole("button", { name: "Зарегистрировать Webhook" }).click();
  await expect(section.getByText(/Webhook зарегистрирован/)).toBeVisible();
  const setWebhook = (await mockRequests(request)).find((r) => r.method === "setWebhook");
  expect(setWebhook?.params).toEqual({
    url: "https://intsoftholding.ru/api/telegram/webhook",
    secret_token: E2E_TG_SECRET,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
    max_connections: 10,
  });

  await section.getByRole("button", { name: "Проверить подключение" }).click();
  await expect(section.getByText("Соединение с Telegram Bot API установлено")).toBeVisible();
  await expect(section.getByText(/@integro_test_bot/)).toBeVisible();
  await expect(section.getByText(/\(этот сайт\)/)).toBeVisible();
});
