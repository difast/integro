import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

/** План продаж: доступ, ввод, сохранение, восстановление, месяцы, ручной факт, автоматический факт, ошибки, телефон. */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });
const PERIOD = "2031-03";
const strip = (s: string | null) => (s ?? "").replace(/ | /g, " ");

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.sales_plans') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("TRUNCATE sales_plans, admin_sessions, admin_login_attempts CASCADE");
  await db.query("DELETE FROM requests WHERE created_at >= '2031-01-01'");
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

test("без входа план продаж недоступен", async ({ page }) => {
  await page.goto(`/admin/plan-prodazh?period=${PERIOD}`);
  await expect(page).toHaveURL(/\/admin\/vhod$/);
});

test("план и факт: живые расчёты, сохранение, восстановление после перезагрузки, независимость месяцев", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "План продаж" }).click();
  await expect(page.getByRole("heading", { name: "План продаж" })).toBeVisible();
  await page.goto(`/admin/plan-prodazh?period=${PERIOD}`);
  await expect(page.getByText("Март 2031").first()).toBeVisible();

  await page.getByLabel("Оценка: Выручка, ₽ — план").fill("1 000 000");
  await page.getByLabel("Оценка: Продажи, шт. — план").fill("20");
  await page.getByLabel("Оценка: Лиды, шт. — план").fill("100");
  await page.getByLabel("Судебная экспертиза: Выручка, ₽ — план").fill("500000");
  await page.getByLabel("Судебная экспертиза: Продажи, шт. — план").fill("5");
  // Карточки и вычисляемые значения пересчитываются без сохранения.
  expect(strip(await page.getByTestId("kpi-revenue-plan").textContent())).toBe("1 500 000 ₽");
  await expect(page.getByTestId("kpi-sales-plan")).toHaveText("25");
  await expect(page.getByTestId("plan-save-status")).toContainText("несохранённые");

  // Отрицательное значение не принимается.
  await page.getByLabel("Судебное заключение: Лиды, шт. — план").fill("-3");
  await expect(page.getByText("Не может быть отрицательным")).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  await page.getByLabel("Судебное заключение: Лиды, шт. — план").fill("");

  // Ручной факт по оценке.
  await page.getByRole("tab", { name: "Оценка" }).click();
  await page.getByRole("radio", { name: "Вручную" }).first().check();
  await page.getByRole("radio", { name: "Вручную" }).nth(1).check();
  await page.getByRole("radio", { name: "Вручную" }).nth(2).check();
  await page.getByLabel("Оценка: Выручка, ₽ — факт (вручную)").fill("1200000");
  await page.getByLabel("Оценка: Продажи, шт. — факт (вручную)").fill("25");
  await page.getByLabel("Оценка: Лиды, шт. — факт (вручную)").fill("80");
  const detail = page.getByRole("region", { name: "Направление «Оценка»" });
  await expect(detail.getByRole("row", { name: /Средний чек/ })).toContainText("50 000");
  await expect(detail.getByRole("row", { name: /Средний чек/ })).toContainText("48 000");
  await expect(detail.getByRole("row", { name: /Конверсия/ })).toContainText("+11,3 п.п.");
  await expect(detail.getByRole("row", { name: /Выручка/ })).toContainText("120,0 %");

  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByTestId("plan-save-status")).toContainText("Сохранено");
  const rows = await db.query("SELECT direction_id, revenue_plan::text, sales_fact, revenue_fact_source FROM sales_plans WHERE period = '2031-03-01' ORDER BY direction_id");
  expect(rows.rows).toEqual([
    { direction_id: "ocenka", revenue_plan: "1000000.00", sales_fact: 25, revenue_fact_source: "manual" },
    { direction_id: "sud_ekspertiza", revenue_plan: "500000.00", sales_fact: null, revenue_fact_source: "auto" },
  ]);

  await page.reload();
  await expect(page.getByLabel("Оценка: Выручка, ₽ — план")).toHaveValue("1000000");
  await expect(page.getByLabel("Судебная экспертиза: Продажи, шт. — план")).toHaveValue("5");
  await expect(page.getByLabel("Судебное заключение: Выручка, ₽ — план")).toHaveValue("");
  expect(strip(await page.getByTestId("kpi-revenue-fact").textContent())).toBe("1 200 000 ₽");
  await expect(page.getByTestId("kpi-conversion")).toHaveText("31,3 %");

  // Следующий месяц пуст; предупреждение о несохранённых изменениях при переходе.
  await page.getByLabel("Судебное заключение: Выручка, ₽ — план").fill("1");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Следующий месяц" }).click();
  await expect(page).toHaveURL(new RegExp(`period=${PERIOD}`));
  await page.getByLabel("Судебное заключение: Выручка, ₽ — план").fill("");
  await page.getByRole("link", { name: "Следующий месяц" }).click();
  await expect(page).toHaveURL(/period=2031-04/);
  await expect(page.getByLabel("Оценка: Выручка, ₽ — план")).toHaveValue("");
  await page.getByLabel("Оценка: Выручка, ₽ — план").fill("700000");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByTestId("plan-save-status")).toContainText("Сохранено");
  await page.getByRole("link", { name: "Предыдущий месяц" }).click();
  await expect(page.getByLabel("Оценка: Выручка, ₽ — план")).toHaveValue("1000000");
});

test("ошибка сети: значения не теряются, повтор сохраняет", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/plan-prodazh?period=2031-06`);
  await page.getByLabel("Судебное заключение: Продажи, шт. — план").fill("7");
  await page.route("**/admin/plan-prodazh**", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByTestId("plan-save-status")).toContainText("Нет связи с сервером");
  await expect(page.getByLabel("Судебное заключение: Продажи, шт. — план")).toHaveValue("7");
  await page.unroute("**/admin/plan-prodazh**");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByTestId("plan-save-status")).toContainText("Сохранено");
  const { rows } = await db.query("SELECT sales_plan FROM sales_plans WHERE period = '2031-06-01' AND direction_id = 'sud_zaklyuchenie'");
  expect(rows).toEqual([{ sales_plan: 7 }]);
});

test("автоматический факт из оплаченных заявок и классификация заявки без направления", async ({ page }) => {
  const insert = async (service: string, paid: boolean) => {
    const { rows } = await db.query(
      `INSERT INTO requests (submission_key, name, phone, phone_digits, service, service_title, message, consent_revision, created_at,
         payment_status, paid_amount, paid_at, direction_id)
       VALUES ($1, 'Автофакт', '+7 900 111-22-33', '9001112233', $2, 'Услуга', 'Текст заявки', 'test', '2031-05-10T10:00:00Z',
         $3, $4, $5, (SELECT id FROM sales_directions WHERE $2 = ANY (service_slugs)))
       RETURNING id`,
      [randomUUID(), service, paid ? "paid" : "none", paid ? "250000" : null, paid ? "2031-05-12" : null],
    );
    return rows[0].id as string;
  };
  await insert("sudebnaya-ekspertiza", true);
  const unclassified = await insert("", false);

  await login(page);
  await page.goto("/admin/plan-prodazh?period=2031-05");
  expect(strip(await page.getByTestId("kpi-revenue-fact").textContent())).toBe("250 000 ₽");
  await expect(page.getByTestId("kpi-sales-fact")).toHaveText("1");
  await expect(page.getByTestId("kpi-leads-fact")).toHaveText("1");
  await expect(page.getByText(/Без направления за месяц: заявок — 1/)).toBeVisible();
  await page.getByRole("tab", { name: "Судебная экспертиза" }).click();
  await expect(page.getByText("Число таких оплаченных заявок").first()).toBeVisible();

  await page.goto(`/admin/zayavki/${unclassified}`);
  await page.getByLabel("Направление (план продаж)").selectOption("sud_zaklyuchenie");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Изменения сохранены.")).toBeVisible();
  const { rows } = await db.query("SELECT direction_id FROM requests WHERE id = $1", [unclassified]);
  expect(rows[0].direction_id).toBe("sud_zaklyuchenie");
  await page.goto("/admin/plan-prodazh?period=2031-05");
  await expect(page.getByText(/Без направления за месяц/)).toHaveCount(0);
  await expect(page.getByTestId("kpi-leads-fact")).toHaveText("2");
});

test.describe("телефон 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  test("страница без горизонтальной прокрутки, таблица прокручивается внутри, ввод работает", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/plan-prodazh?period=${PERIOD}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("tab", { name: "Судебное заключение" }).click();
    await page.getByLabel("Судебное заключение: Лиды, шт. — план").fill("40");
    await expect(page.getByRole("button", { name: "Сохранить" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
