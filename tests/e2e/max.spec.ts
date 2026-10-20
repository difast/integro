import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD, E2E_MAX_MOCK, E2E_MAX_SECRET, E2E_MAX_TOKEN } from "../../playwright.config";

/**
 * Чат-бот MAX от первого сообщения до ответа оператора: Webhook → база → админка → MAX API.
 * Вместо platform-api2.max.ru — имитация (tests/e2e/max-mock-server.mjs), которая записывает запросы.
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });
const user = { user_id: 777001, first_name: "Пётр", last_name: "Сидоров", username: "petr_e2e", is_bot: false };
let ts = Date.now();

type MockRequest = { method: string; path: string; query: Record<string, string>; auth: string | null; body: { text?: string; url?: string; secret?: string; update_types?: string[] } | null };
const mockRequests = async (request: APIRequestContext): Promise<MockRequest[]> => (await request.get(`${E2E_MAX_MOCK}/__requests`)).json();
const sentTexts = async (request: APIRequestContext) =>
  (await mockRequests(request)).filter((r) => r.method === "POST" && r.path === "/messages").map((r) => r.body?.text ?? "");

function message(text: string) {
  ts += 1000;
  return {
    update_type: "message_created",
    timestamp: ts,
    message: { sender: user, recipient: { chat_id: 4242, chat_type: "dialog" }, timestamp: ts, body: { mid: `e2e.in.${ts}`, text } },
  };
}

const webhook = (request: APIRequestContext, data: unknown, secret: string | null = E2E_MAX_SECRET) =>
  request.post("/api/max/webhook", { data, headers: secret ? { "X-Max-Bot-Api-Secret": secret } : {} });

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
  await db.query("TRUNCATE chat_messages, chat_notes, chat_events, chat_clients RESTART IDENTITY CASCADE");
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context, request }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
  await request.post(`${E2E_MAX_MOCK}/__reset`);
});

test("Webhook: без секрета или с чужим секретом — 401; повторная доставка не создаёт дубль", async ({ request }) => {
  const update = message("Здравствуйте");
  expect((await webhook(request, update, null)).status()).toBe(401);
  expect((await webhook(request, update, "wrong-secret-wrong-secret-wrong-secret")).status()).toBe(401);
  expect((await request.post("/api/max/webhook", { data: "{not json", headers: { "X-Max-Bot-Api-Secret": E2E_MAX_SECRET, "Content-Type": "application/json" } })).status()).toBe(400);
  expect((await webhook(request, update)).status()).toBe(200);
  expect((await webhook(request, update)).status()).toBe(200);

  await expect.poll(async () => (await sentTexts(request)).length).toBe(1);
  const texts = await sentTexts(request);
  expect(texts[0]).toContain("ООО «Интегро»");
  const { rows } = await db.query("SELECT count(*)::int AS n FROM chat_messages WHERE direction = 'in'");
  expect(rows[0].n).toBe(1);
  // Токен — только в заголовке.
  const all = await mockRequests(request);
  expect(all.every((r) => r.auth === E2E_MAX_TOKEN && !JSON.stringify(r.query).includes(E2E_MAX_TOKEN))).toBe(true);
  // Сервер без настроенного бота события не принимает.
  expect((await request.post("http://localhost:3202/api/max/webhook", { data: update, headers: { "X-Max-Bot-Api-Secret": E2E_MAX_SECRET } })).status()).toBe(503);
});

test("без входа раздел MAX недоступен", async ({ page }) => {
  for (const path of ["/admin/max", "/admin/max/nastroyki", "/admin/obrashcheniya", "/admin/obrashcheniya/nastroyki"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  }
});

test("оператор видит обращение, отвечает из админки — ответ уходит в MAX; режимы переключаются", async ({ page, request }) => {
  await webhook(request, message("Нужна рецензия на заключение эксперта, сколько это стоит?"));
  await expect.poll(async () => (await sentTexts(request)).length).toBeGreaterThan(0);

  await login(page);
  await page.getByRole("link", { name: "Обращения", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Обращения из мессенджеров");
  const row = page.getByRole("link", { name: /Пётр Сидоров/ });
  await expect(row).toContainText(`ID ${user.user_id}`);

  // Поиск по тексту сообщения.
  await page.getByLabel(/Поиск по имени/).fill("рецензия");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByRole("link", { name: /Пётр Сидоров/ })).toBeVisible();
  await page.getByRole("link", { name: /Пётр Сидоров/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пётр Сидоров");
  const dialog = page.getByRole("list", { name: "Сообщения по времени" });
  await expect(dialog).toContainText("Нужна рецензия на заключение эксперта");
  await expect(dialog).toContainText("сообщит специалист после изучения обращения");

  await request.post(`${E2E_MAX_MOCK}/__reset`);
  await page.getByLabel("Ответ клиенту").fill("Здравствуйте, Пётр! Пришлите, пожалуйста, номер дела.");
  await page.getByRole("button", { name: "Отправить в MAX" }).click();
  await expect(page.getByRole("status").filter({ hasText: "MAX подтвердил отправку" })).toBeVisible();
  await expect(page.getByLabel("Ответ клиенту")).toHaveValue("");

  const sent = (await mockRequests(request)).filter((r) => r.path === "/messages");
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ method: "POST", query: { user_id: String(user.user_id) }, auth: E2E_MAX_TOKEN, body: { text: "Здравствуйте, Пётр! Пришлите, пожалуйста, номер дела." } });
  await expect(dialog).toContainText("Отправлено, платформа подтвердила");
  await expect(page.getByText("Оператор: бот не отвечает автоматически")).toBeVisible();

  // В режиме оператора новое сообщение клиента появляется в карточке, бот молчит.
  await request.post(`${E2E_MAX_MOCK}/__reset`);
  await webhook(request, message("Номер дела А40-12345/2026"));
  await expect(dialog).toContainText("Номер дела А40-12345/2026", { timeout: 15_000 });
  expect(await sentTexts(request)).toHaveLength(0);
  await expect(page.getByText("Нужен ответ").first()).toBeVisible();

  // Внутренняя заметка — только в админке, клиенту не отправляется.
  await page.getByLabel("Внутренняя заметка").fill("Клиент — сторона по делу, перезвонить после 15:00");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Заметка добавлена" })).toBeVisible();
  expect(await sentTexts(request)).toHaveLength(0);

  // Возврат боту: снова отвечает по сценарию.
  await page.getByRole("button", { name: "Вернуть диалог боту" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Диалог передан боту" })).toBeVisible();
  await webhook(request, message("меню"));
  await expect.poll(async () => (await sentTexts(request)).length).toBe(1);

  // Закрытие диалога и возврат в работу.
  await page.getByRole("button", { name: "Закрыть диалог" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Диалог закрыт" })).toBeVisible();
  await page.getByRole("button", { name: "Вернуть в работу" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Диалог возвращён в работу" })).toBeVisible();
});

test("настройки: переменные без значений, проверка подключения и регистрация Webhook через API", async ({ page, request }) => {
  await login(page);
  // Прежний адрес настроек MAX ведёт в общие настройки каналов.
  await page.goto("/admin/max/nastroyki");
  await expect(page).toHaveURL(/\/admin\/obrashcheniya\/nastroyki$/);
  const section = page.getByRole("region", { name: "MAX" });
  await expect(section.getByText("MAX_BOT_TOKEN — задано")).toBeVisible();
  await expect(section.getByText("MAX_WEBHOOK_SECRET — задано")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain(E2E_MAX_TOKEN);
  expect(html).not.toContain(E2E_MAX_SECRET);

  await section.getByRole("button", { name: "Проверить подключение" }).click();
  await expect(section.getByText("Соединение с MAX API установлено")).toBeVisible();
  await expect(section.getByText(/@id9734021152_bot/)).toBeVisible();

  await section.getByRole("button", { name: "Зарегистрировать Webhook" }).click();
  await expect(section.getByText(/Webhook зарегистрирован/)).toBeVisible();
  const subscribe = (await mockRequests(request)).find((r) => r.method === "POST" && r.path === "/subscriptions");
  expect(subscribe?.body).toEqual({
    url: "https://intsoftholding.ru/api/max/webhook",
    secret: E2E_MAX_SECRET,
    update_types: ["bot_started", "bot_stopped", "message_created", "message_callback", "dialog_removed"],
  });
});
