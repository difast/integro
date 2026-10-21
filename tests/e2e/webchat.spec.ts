import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

/** Онлайн-чат на сайте: посетитель и оператор в разных браузерных сессиях. */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT 1 FROM schema_migrations WHERE id = '009_web_chat'");
    if (rows.length) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("DELETE FROM chat_clients WHERE channel = 'web'");
  await db.query("TRUNCATE admin_sessions, admin_login_attempts");
});

test.afterAll(async () => {
  await db.end();
});

async function visitorPage(browser: Browser, baseURL: string, viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ baseURL, viewport, locale: "ru-RU" });
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
  return { context, page: await context.newPage() };
}

async function adminPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, locale: "ru-RU" });
  const page = await context.newPage();
  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin$/);
  return page;
}

test("посетитель пишет, оператор отвечает: «печатает», ответ без перезагрузки, история после перезагрузки", async ({ browser, baseURL }) => {
  const { page: visitor } = await visitorPage(browser, baseURL!);
  const errors: string[] = [];
  visitor.on("pageerror", (e) => errors.push(e.message));
  await visitor.goto("/");
  await expect(visitor.getByTestId("webchat-launcher")).toBeVisible();
  // Загрузка страницы и открытие окна не создают диалог.
  await visitor.getByTestId("webchat-launcher").click();
  await expect(visitor.getByTestId("webchat-greeting")).toContainText("Меня зовут Анастасия");
  await expect(visitor.getByTestId("webchat-panel")).toContainText("Онлайн-консультант компании «Интегро»");
  await visitor.getByRole("button", { name: "Свернуть чат" }).click();
  await expect(visitor.getByTestId("webchat-panel")).toHaveCount(0);
  await visitor.getByTestId("webchat-launcher").click();
  expect((await db.query("SELECT id FROM chat_clients WHERE channel = 'web'")).rows).toHaveLength(0);

  // Без согласия не отправляется.
  await visitor.getByLabel("Сообщение консультанту").fill("Нужна оценка квартиры");
  await visitor.keyboard.press("Enter");
  await expect(visitor.getByTestId("webchat-panel").getByRole("alert")).toContainText("согласие");
  await visitor.getByLabel(/Согласен/).check();
  // Shift+Enter — перенос строки, Enter — отправка.
  await visitor.getByLabel("Сообщение консультанту").press("Shift+Enter");
  await visitor.getByLabel("Сообщение консультанту").pressSequentially("для наследства");
  await visitor.keyboard.press("Enter");
  await expect(visitor.getByTestId("webchat-message-visitor")).toContainText("Нужна оценка квартиры\nдля наследства");
  await expect(visitor.getByTestId("webchat-message-visitor").getByLabel("доставлено")).toBeVisible();
  const { rows } = await db.query("SELECT c.id, m.text FROM chat_clients c JOIN chat_messages m ON m.client_id = c.id WHERE c.channel = 'web'");
  expect(rows).toHaveLength(1);
  expect(rows[0].text).toBe("Нужна оценка квартиры\nдля наследства");
  const clientId = rows[0].id as string;

  // Оператор видит новый диалог в разделе «Веб-чат» без ручного обновления.
  const admin = await adminPage(browser, baseURL!);
  await admin.getByRole("link", { name: "Веб-чат" }).click();
  const item = admin.locator(`a[href="/admin/obrashcheniya/${clientId}"]`);
  await expect(item).toContainText("Нужна оценка квартиры");
  await expect(item).toContainText("Нужен ответ");
  await expect(item.locator("[title='Непрочитанные сообщения']")).toHaveText("1");
  await item.click();
  await expect(admin.getByText("Нужна оценка квартиры").first()).toBeVisible();

  // Набор ответа → у посетителя «Анастасия печатает…».
  await admin.getByLabel("Ответ клиенту").pressSequentially("Добрый день! Уточните, пожалуйста, район.", { delay: 15 });
  await expect(visitor.getByTestId("webchat-status")).toHaveText("Анастасия печатает…", { timeout: 10_000 });
  await admin.getByRole("button", { name: /Отправить в чат на сайте/ }).click();
  await expect(admin.getByText("Ответ сохранён и показан посетителю")).toBeVisible();
  await expect(visitor.getByTestId("webchat-message-consultant")).toContainText("Уточните, пожалуйста, район", { timeout: 10_000 });
  await expect(visitor.getByTestId("webchat-status")).not.toHaveText("Анастасия печатает…");
  // Оператор видит отметку о прочтении (посетитель с открытым окном).
  await expect(admin.getByText("Показано посетителю · прочитано")).toBeVisible({ timeout: 10_000 });

  // Посетитель отвечает — у оператора сообщение появляется без перезагрузки.
  await visitor.getByLabel("Сообщение консультанту").fill("Центральный район, 54 м²");
  await visitor.keyboard.press("Enter");
  await expect(admin.getByText("Центральный район, 54 м²")).toBeVisible({ timeout: 10_000 });

  // После перезагрузки страницы — та же переписка.
  await visitor.reload();
  await visitor.getByTestId("webchat-launcher").click();
  await expect(visitor.getByTestId("webchat-message-visitor")).toHaveCount(2);
  await expect(visitor.getByTestId("webchat-message-consultant")).toHaveCount(1);
  expect(errors).toEqual([]);

  // Внутренняя заметка оператора посетителю не видна.
  await admin.getByLabel("Внутренняя заметка").fill("Внутреннее: клиент из Москвы");
  await admin.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(admin.getByText("Заметка добавлена.")).toBeVisible();
  const updates = await visitor.request.get("/api/webchat");
  expect(await updates.text()).not.toContain("клиент из Москвы");

  // Закрытие диалога видно посетителю.
  await admin.getByRole("button", { name: "Закрыть диалог" }).click();
  await expect(visitor.getByTestId("webchat-status")).toContainText("Диалог завершён", { timeout: 10_000 });
});

test("сбой сети: сообщение не теряется, повтор не создаёт дубль", async ({ browser, baseURL }) => {
  const { page } = await visitorPage(browser, baseURL!);
  await page.goto("/uslugi/ocenka");
  await page.getByTestId("webchat-launcher").click();
  await page.getByLabel(/Согласен/).check();
  await page.route("**/api/webchat/messages", (route) => route.abort());
  await page.getByLabel("Сообщение консультанту").fill("Сообщение при обрыве связи");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Не отправлено", { exact: true })).toBeVisible();
  await expect(page.getByTestId("webchat-message-visitor")).toContainText("Сообщение при обрыве связи");
  expect((await db.query("SELECT id FROM chat_messages WHERE text = 'Сообщение при обрыве связи'")).rows).toHaveLength(0);
  await page.unroute("**/api/webchat/messages");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByTestId("webchat-message-visitor").getByLabel("доставлено")).toBeVisible();
  // Ответ сервера потерян после сохранения: повтор с тем же ключом — без дубля.
  let calls = 0;
  await page.route("**/api/webchat/messages", async (route) => {
    calls += 1;
    const response = await route.fetch();
    if (calls === 1) await route.abort();
    else await route.fulfill({ response });
  });
  await page.getByLabel("Сообщение консультанту").fill("Ответ сервера потерялся");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Не отправлено", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByTestId("webchat-message-visitor").filter({ hasText: "Ответ сервера потерялся" }).getByLabel("доставлено")).toBeVisible();
  expect((await db.query("SELECT id FROM chat_messages WHERE text = 'Ответ сервера потерялся'")).rows).toHaveLength(1);
});

test("потеря связи при получении: предупреждение, после восстановления — пропущенный ответ без дублей", async ({ browser, baseURL }) => {
  const { page } = await visitorPage(browser, baseURL!);
  await page.goto("/");
  await page.getByTestId("webchat-launcher").click();
  await page.getByLabel(/Согласен/).check();
  await page.getByLabel("Сообщение консультанту").fill("Проверка связи");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("webchat-message-visitor").getByLabel("доставлено")).toBeVisible();
  const { rows } = await db.query("SELECT client_id FROM chat_messages WHERE text = 'Проверка связи'");
  await page.route("**/api/webchat?**", (route) => route.abort());
  await page.route("**/api/webchat", (route) => route.abort());
  await expect(page.getByTestId("webchat-status")).toContainText("Нет связи с сервером", { timeout: 20_000 });
  // Пока связи нет, оператор отвечает.
  await db.query(
    "INSERT INTO chat_messages (client_id, direction, author, kind, text, status, sent_at) VALUES ($1, 'out', 'operator', 'text', 'Ответ во время обрыва', 'sent', now())",
    [rows[0].client_id],
  );
  await page.unroute("**/api/webchat?**");
  await page.unroute("**/api/webchat");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("webchat-message-consultant")).toHaveText(/Ответ во время обрыва/, { timeout: 15_000 });
  await expect(page.getByTestId("webchat-status")).not.toContainText("Нет связи");
  await page.waitForTimeout(4_000);
  await expect(page.getByTestId("webchat-message-consultant")).toHaveCount(1);
  await expect(page.getByTestId("webchat-message-visitor")).toHaveCount(1);
});

test("доступ: чужая переписка недоступна, API защищены", async ({ browser, baseURL, request }) => {
  // Новый браузер без cookie — диалога нет.
  const { context } = await visitorPage(browser, baseURL!);
  const fresh = await context.request.get("/api/webchat");
  expect(await fresh.json()).toEqual({ dialog: false });
  // Подделанная cookie не даёт доступа.
  const forged = await request.get("/api/webchat", { headers: { cookie: `__Host-integro-chat=${"A".repeat(43)}; integro-chat=${"A".repeat(43)}` } });
  expect(await forged.json()).toEqual({ dialog: false });
  // Запросы без заголовка Origin этого сайта (межсайтовые) отклоняются.
  const cross = await request.post("/api/webchat/messages", {
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    data: { text: "spam", key: "00000000-0000-4000-8000-000000000000", consent: true },
  });
  expect(cross.status()).toBe(403);
  const typing = await request.post("/api/admin/webchat/typing", { headers: { "content-type": "application/json", origin: baseURL! }, data: { clientId: "x" } });
  expect(typing.status()).toBe(401);
  const page = await context.newPage();
  await page.goto("/admin/veb-chat");
  await expect(page).toHaveURL(/\/admin\/vhod$/);
  // Пустое и слишком длинное сообщение сервер не принимает.
  const empty = await context.request.post("/api/webchat/messages", { headers: { "content-type": "application/json", origin: baseURL! }, data: { text: "   ", key: crypto.randomUUID(), consent: true } });
  expect(empty.status()).toBe(400);
  const long = await context.request.post("/api/webchat/messages", { headers: { "content-type": "application/json", origin: baseURL! }, data: { text: "а".repeat(2001), key: crypto.randomUUID(), consent: true } });
  expect(long.status()).toBe(400);
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  test("окно на весь экран, поле ввода видно, без горизонтальной прокрутки, длинные сообщения переносятся", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
    await page.goto("/");
    await page.getByTestId("webchat-launcher").tap();
    await expect(page.getByLabel("Сообщение консультанту")).toBeInViewport();
    await page.getByLabel(/Согласен/).check();
    await page.getByLabel("Сообщение консультанту").fill(`Длинное_слово_${"x".repeat(200)} и обычный текст`);
    await page.getByRole("button", { name: "Отправить сообщение" }).tap();
    await expect(page.getByTestId("webchat-message-visitor").getByLabel("доставлено")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const box = (await page.getByTestId("webchat-message-visitor").locator("div").first().boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  });
});
