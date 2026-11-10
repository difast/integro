import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });
// Свой адрес для ограничения частоты отправки заявок, чтобы не расходовать общий лимит других тестов.
test.use({
  extraHTTPHeaders: { "x-real-ip": "198.51.100.88" },
  // Обычный мобильный браузер: тестовый HeadlessChrome справедливо отсеивается как робот.
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 330.0",
});

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.marketing_links') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("DELETE FROM marketing_link_clicks");
  await db.query("TRUNCATE admin_sessions, admin_login_attempts");
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

const clicks = async (slug: string) =>
  Number(
    (await db.query("SELECT count(*) FROM marketing_link_clicks c JOIN marketing_links l ON l.id = c.link_id WHERE l.slug = $1", [slug])).rows[0]
      .count,
  );

test("короткая ссылка: переход засчитывается, роботы — нет, неизвестная ссылка ведёт на главную", async ({ page, request }) => {
  await page.goto("/go/threads-vera");
  await expect(page).toHaveURL(/\/\?utm_source=threads&utm_medium=social&utm_campaign=threads&utm_content=threads-vera$/);
  expect(await clicks("threads-vera")).toBe(1);

  const preview = await request.get("/go/threads", { headers: { "user-agent": "facebookexternalhit/1.1" }, maxRedirects: 0 });
  expect(preview.status()).toBe(302);
  expect(preview.headers().location).toBe("/?utm_source=threads&utm_medium=social&utm_campaign=threads&utm_content=threads");
  expect(await clicks("threads")).toBe(0);

  const unknown = await request.get("/go/no-such-link", { maxRedirects: 0 });
  expect(unknown.headers().location).toBe("/");
});

test("заявка после перехода по ссылке видна во вкладке «Маркетинг»", async ({ page }) => {
  const name = `Threads ${Date.now()}`;
  await page.goto("/go/threads");
  // Сайт запоминает источник перехода сразу после загрузки страницы; дальше посетитель ходит по сайту.
  await page.waitForFunction(() => sessionStorage.getItem("integro-attribution")?.includes("utm_content"));
  await page.goto("/kontakty");
  await page.getByLabel("Как к вам обращаться").fill(name);
  await page.getByLabel("Телефон").fill("+7 999 765-43-21");
  await page.getByLabel("Опишите задачу").fill("Увидел вас в Threads, нужна оценка квартиры");
  await page.getByLabel(/Даю согласие/).check();
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Заявка отправлена")).toBeVisible();
  const { rows } = await db.query("SELECT attribution->>'utm_content' AS content FROM requests WHERE name = $1", [name]);
  expect(rows).toEqual([{ content: "threads" }]);

  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin$/);
  await page.getByRole("navigation", { name: "Разделы панели" }).getByRole("link", { name: "Маркетинг" }).click();
  await expect(page.getByRole("heading", { name: "Маркетинг", level: 1 })).toBeVisible();
  await expect(page.getByTestId("marketing-row-threads-vera")).toContainText("Вера, HR");
  await expect(page.getByTestId("marketing-row-threads")).toContainText("Владелец");
  await expect(page.getByTestId("marketing-clicks-threads")).toHaveText("1");
  await expect(page.getByTestId("marketing-requests-threads")).toHaveText("1");
  await expect(page.getByTestId("marketing-row-threads-vera")).toContainText("https://intsoftholding.ru/go/threads-vera");
});
