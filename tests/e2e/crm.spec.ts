import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

/** CRM: доступ к новым разделам, ручная заявка и воронка, аналитика и CSV, центр уведомлений, мобильная админка. */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.notifications') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query(
    "TRUNCATE requests, request_history, notifications, notification_deliveries, chat_messages, chat_events, chat_clients, admin_sessions, admin_login_attempts CASCADE",
  );
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

async function login(page: Page) {
  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin$/);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("новые разделы и API закрыты без входа", async ({ page, request }) => {
  for (const path of ["/api/admin/analytics/export", "/api/admin/analytics/export?kind=requests", "/api/admin/notifications"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
  for (const path of ["/api/admin/push", "/api/admin/backup"]) {
    const response = await request.post(path, { headers: { origin: "http://localhost:3201" }, data: {} });
    expect([401, 403], path).toContain(response.status());
  }
  for (const path of ["/admin/analitika", "/admin/analitika/prichiny", "/admin/uvedomleniya", "/admin/uvedomleniya/nastroyki", "/admin/sistema", "/admin/sistema/zhurnal", "/admin/zayavki/novaya"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/vhod$/);
  }
});

test("ручная заявка из WhatsApp → этап и сумма → аналитика и CSV", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Новая заявка" }).click();
  await page.getByLabel("Канал обращения").selectOption("whatsapp");
  await page.getByLabel("Имя клиента").fill("Пётр Ручной");
  await page.getByRole("textbox", { name: "Телефон" }).fill("+7 911 000-11-22");
  await page.getByLabel("Суть обращения").fill("=1+1 Оценка дома для суда");
  await page.getByRole("button", { name: "Создать заявку" }).click();
  await page.waitForURL(/\/admin\/zayavki\/[0-9a-f-]{36}\?created=1$/);
  await expect(page.getByText("Пётр Ручной").first()).toBeVisible();

  await page.getByLabel("Этап").selectOption("won");
  await page.getByLabel("Сумма по договору").fill("45 000");
  await page.getByLabel("Ответственный").fill("Иванова");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Изменения сохранены.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Сделка выиграна/).first()).toBeVisible();

  const { rows } = await db.query("SELECT field, new_value FROM request_history ORDER BY id");
  expect(rows.map((r) => r.field)).toEqual(expect.arrayContaining(["created", "stage", "assignee", "deal_amount"]));

  await page.goto("/admin/analitika");
  await expect(page.getByTestId("metric-requests")).toHaveText("1");
  await expect(page.getByTestId("metric-won")).toHaveText("1");
  await expect(page.getByTestId("money-RUB")).toContainText("45");
  await expect(page.getByTestId("conversion-win_rate")).toContainText("100 %");

  await page.getByRole("combobox", { name: "Канал", exact: true }).selectOption("site");
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page.getByTestId("analytics-empty")).toBeVisible();

  const csv = await page.request.get("/api/admin/analytics/export?kind=requests");
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain("WhatsApp");
  expect(text).toContain("Иванова");
  expect(text).not.toContain("Пётр Ручной");
  expect(text).not.toContain("911");
  const summary = await (await page.request.get("/api/admin/analytics/export")).text();
  expect(summary).toContain("Воронка: Сделка выиграна");
});

test("заявка с сайта появляется в центре уведомлений; отметка о прочтении", async ({ page, baseURL }) => {
  await db.query("TRUNCATE notifications CASCADE");
  await page.goto(`${baseURL}/kontakty?usluga=ocenka&utm_source=yandex&utm_medium=cpc`);
  await page.getByLabel("Как к вам обращаться").fill("Уведомляемый Клиент");
  await page.getByLabel("Телефон").fill("+7 999 111-22-33");
  await page.getByLabel("Опишите задачу").fill("Проверка уведомлений администратора");
  await page.getByLabel(/Даю согласие/).check();
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: /Отправить/ }).first().click();
  await expect(page.getByText(/Заявка отправлена|принята/i).first()).toBeVisible();

  const { rows } = await db.query("SELECT attribution FROM requests WHERE name = 'Уведомляемый Клиент'");
  expect(rows[0].attribution).toMatchObject({ utm_source: "yandex", utm_medium: "cpc" });

  await login(page);
  await expect(page.getByRole("button", { name: /Уведомления: непрочитанных 1/ })).toBeVisible({ timeout: 25_000 });
  await page.goto("/admin/uvedomleniya");
  await expect(page.getByText(/Новая заявка/).first()).toBeVisible();
  await page.getByRole("button", { name: "Отметить все прочитанными" }).click();
  await expect(page.getByRole("button", { name: "Уведомления", exact: true })).toBeVisible({ timeout: 25_000 });
  const unread = await db.query("SELECT count(*)::int AS n FROM notifications WHERE read_at IS NULL");
  expect(unread.rows[0].n).toBe(0);
});

test.describe("мобильная админка 360–390 px", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("списки без горизонтальной прокрутки; ответ в чате — черновик сохраняется, отправка работает", async ({ page }) => {
    const { rows } = await db.query(
      "INSERT INTO chat_clients (channel, external_user_id, chat_id, first_name, status, needs_reply) VALUES ('telegram', 880001, 880001, 'Мобильный', 'open', true) RETURNING id",
    );
    const clientId = rows[0].id as string;
    await login(page);
    await noHorizontalOverflow(page);
    for (const path of ["/admin/obrashcheniya", "/admin/analitika", "/admin/uvedomleniya", "/admin/uvedomleniya/nastroyki", "/admin/sistema", "/admin/sistema/zhurnal", "/admin/zayavki/novaya", "/admin/statistika"]) {
      await page.goto(path);
      await noHorizontalOverflow(page);
    }

    await page.goto(`/admin/obrashcheniya/${clientId}`);
    await noHorizontalOverflow(page);
    const field = page.getByLabel("Ответ клиенту");
    await field.tap();
    await field.fill("Здравствуйте! Подготовим оценку.");
    await page.reload();
    await expect(page.getByLabel("Ответ клиенту")).toHaveValue("Здравствуйте! Подготовим оценку.");
    await expect(page.getByLabel("Ответ клиенту")).toBeInViewport();
    await page.getByRole("button", { name: /Отправить в Telegram/ }).click();
    await expect(page.getByLabel("Ответ клиенту")).toHaveValue("");
    await expect(page.getByText("Здравствуйте! Подготовим оценку.").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Ответ клиенту")).toHaveValue("");
  });
});
