import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });

test.beforeAll(async () => {
  await db.connect();
  // Схему создаёт сервер при запуске; ждём её появления.
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.requests') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("TRUNCATE requests, admin_sessions, admin_login_attempts CASCADE");
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context }) => {
  // Уведомление о cookie закрыто, чтобы не перекрывало кнопки.
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

async function seed(name: string, extra: { phone?: string; email?: string; status?: string; minutesAgo?: number } = {}) {
  await db.query(
    `INSERT INTO requests (submission_key, name, phone, phone_digits, email, service, service_title, message, status, consent_revision, created_at)
     VALUES ($1, $2, $3, $4, $5, '', 'Не выбрано', 'Текст обращения для теста', $6, '16.10.2026', now() - make_interval(mins => $7))`,
    [
      randomUUID(),
      name,
      extra.phone ?? "",
      (extra.phone ?? "").replace(/\D/g, "").replace(/^[78](\d{10})$/, "$1"),
      extra.email ?? "",
      extra.status ?? "new",
      extra.minutesAgo ?? 0,
    ],
  );
}

async function login(page: Page, password = E2E_ADMIN_PASSWORD) {
  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  if (password === E2E_ADMIN_PASSWORD) await page.waitForURL(/\/admin$/);
}

async function fillRequestForm(page: Page, baseURL: string, name: string) {
  await page.goto(`${baseURL}/kontakty?usluga=ocenka`);
  await page.getByLabel("Как к вам обращаться").fill(name);
  await page.getByLabel("Телефон").fill("+7 999 765-43-21");
  await page.getByLabel("Электронная почта").fill("client@example.ru");
  await page.getByLabel("Опишите задачу").fill("Нужна оценка квартиры для нотариуса");
  await page.getByLabel(/Даю согласие/).check();
  // Сервер отклоняет формы, заполненные быстрее 3 секунд.
  await page.waitForTimeout(3_200);
}

test("без авторизации данные недоступны", async ({ page, request }) => {
  const api = await request.get("/api/admin/export");
  expect(api.status()).toBe(401);
  expect(await api.text()).not.toContain("Текст обращения");

  const withForgedCookie = await request.get("/api/admin/export", {
    headers: { cookie: "__Host-integro-admin=forged; integro-admin=forged" },
  });
  expect(withForgedCookie.status()).toBe(401);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/vhod$/);
  await page.goto("/admin/zayavki/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/admin\/vhod$/);

  const robots = await request.get("/admin/vhod");
  expect(robots.headers()["x-robots-tag"]).toContain("noindex");
});

test("неверный пароль не даёт доступ, верный — даёт; выход завершает сессию", async ({ page, context, request }) => {
  await login(page, "wrong-password-000");
  await expect(page.getByRole("alert").filter({ hasText: "Неверный пароль" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/vhod$/);

  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Заявки", level: 1 })).toBeVisible();

  const cookie = (await context.cookies()).find((item) => item.name.includes("integro-admin"));
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.secure).toBe(true);
  expect(cookie?.name).toBe("__Host-integro-admin");
  // Пароль не попадает в HTML страницы.
  expect(await page.content()).not.toContain(E2E_ADMIN_PASSWORD);

  const authed = await request.get("/api/admin/export", { headers: { cookie: `${cookie!.name}=${cookie!.value}` } });
  expect(authed.status()).toBe(200);

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/admin\/vhod$/);
  // Старый токен после выхода недействителен на сервере.
  const replay = await request.get("/api/admin/export", { headers: { cookie: `${cookie!.name}=${cookie!.value}` } });
  expect(replay.status()).toBe(401);
});

test("заявка с сайта сохраняется один раз и появляется в админке", async ({ page, baseURL }) => {
  const name = `Клиент ${Date.now()}`;
  await fillRequestForm(page, baseURL!, name);
  await page.getByRole("button", { name: "Отправить заявку" }).dblclick();
  await expect(page.getByText("Заявка отправлена")).toBeVisible();

  const { rows } = await db.query("SELECT name, service, source_page, status FROM requests WHERE name = $1", [name]);
  expect(rows).toEqual([{ name, service: "ocenka", source_page: "/kontakty?usluga=ocenka", status: "new" }]);

  await login(page);
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Оценочная деятельность");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Новая");
});

test("ошибка базы не даёт ложного сообщения об успехе", async ({ page }) => {
  await fillRequestForm(page, "http://localhost:3202", "Проверка сбоя");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Не удалось отправить заявку" })).toBeVisible();
  await expect(page.getByText("Заявка отправлена")).toHaveCount(0);
  // Введённые данные сохраняются для повторной попытки.
  await expect(page.getByLabel("Как к вам обращаться")).toHaveValue("Проверка сбоя");
});

test("статус и заметки сохраняются; поиск, фильтр, удаление", async ({ page }) => {
  await seed("Анна Смирнова", { phone: "8 (916) 555-11-22", email: "anna@mail.ru", minutesAgo: 10 });
  await seed("Борис Ковалёв", { phone: "+7 903 222-33-44", email: "boris@firma.ru", status: "done", minutesAgo: 5 });
  await login(page);

  await page.getByRole("searchbox").fill("+7 916 555 11 22");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page.getByRole("row", { name: /Анна Смирнова/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Борис/ })).toHaveCount(0);

  await page.goto("/admin?q=FIRMA.RU");
  await expect(page.getByRole("row", { name: /Борис Ковалёв/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Анна/ })).toHaveCount(0);

  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Фильтр по статусу" }).getByRole("link", { name: /Завершена/ }).click();
  await expect(page).toHaveURL(/status=done/);
  await expect(page.getByRole("row", { name: /Борис Ковалёв/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Анна/ })).toHaveCount(0);

  await page.goto("/admin");
  await page.getByRole("row", { name: /Анна Смирнова/ }).getByRole("link", { name: /Открыть/ }).click();
  await page.getByLabel("Статус обработки").selectOption("waiting_client");
  await page.getByLabel("Внутренние заметки").fill("Перезвонить в пятницу");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Изменения сохранены" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Статус обработки")).toHaveValue("waiting_client");
  await expect(page.getByLabel("Внутренние заметки")).toHaveValue("Перезвонить в пятницу");

  await page.getByRole("button", { name: "Удалить заявку" }).click();
  await page.getByRole("button", { name: "Да, удалить" }).click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(page.getByRole("row", { name: /Анна Смирнова/ })).toHaveCount(0);
});

test("CSV доступен после входа, кириллица и формулы обработаны", async ({ page }) => {
  await seed("=HYPERLINK(\"http://evil\")", { email: "x@y.ru" });
  await seed("Ольга Ёлкина", { status: "in_progress" });
  await login(page);

  const all = await page.request.get("/api/admin/export");
  expect(all.status()).toBe(200);
  expect(all.headers()["content-type"]).toContain("text/csv");
  const text = (await all.body()).toString("utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('"Ольга Ёлкина"');
  expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);

  const filtered = await (await page.request.get("/api/admin/export?status=in_progress")).text();
  expect(filtered).toContain("Ольга Ёлкина");
  expect(filtered).not.toContain("HYPERLINK");
});

test("переходы в мессенджеры учитываются и видны в статистике", async ({ browser, request, baseURL }) => {
  await db.query("TRUNCATE messenger_clicks");
  // Обычный браузер: переходы из headless-браузеров отсекаются как роботы.
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  });
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
  await context.route(/^https:\/\/(wa\.me|t\.me)\//, (route) => route.fulfill({ body: "ok" }));
  const page = await context.newPage();

  await page.goto("/kontakty");
  for (const link of [
    page.locator("footer").getByRole("link", { name: "WhatsApp" }),
    page.locator("header").getByRole("link", { name: "Написать в Telegram" }),
  ]) {
    const popup = context.waitForEvent("page");
    await link.click();
    await (await popup).close();
  }

  await expect
    .poll(async () => (await db.query("SELECT messenger, placement, page_path FROM messenger_clicks ORDER BY id")).rows)
    .toEqual([
      { messenger: "whatsapp", placement: "footer", page_path: "/kontakty" },
      { messenger: "telegram", placement: "header", page_path: "/kontakty" },
    ]);

  // Роботы, чужие сайты и неверные данные не учитываются.
  const event = { messenger: "whatsapp", placement: "footer", path: "/" };
  const browserUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36";
  for (const headers of <Record<string, string>[]>[
    { origin: "http://localhost:3201", "user-agent": "Mozilla/5.0 (compatible; YandexBot/3.0)" },
    { origin: "https://evil.example", "user-agent": browserUa },
    { "user-agent": browserUa },
  ]) {
    const response = await request.post("/api/clicks", { data: event, headers });
    expect(response.status()).toBe(204);
  }
  await request.post("/api/clicks", {
    data: { ...event, messenger: "viber" },
    headers: { origin: "http://localhost:3201", "user-agent": browserUa },
  });
  expect((await db.query("SELECT count(*)::int AS n FROM messenger_clicks")).rows[0].n).toBe(2);

  // Без входа статистика недоступна.
  await page.goto("/admin/statistika");
  await expect(page).toHaveURL(/\/admin\/vhod$/);

  await login(page);
  await page.getByRole("link", { name: "Статистика" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Переходы в мессенджеры");
  await expect(page.getByTestId("clicks-total")).toHaveText("2");
  await expect(page.getByTestId("clicks-whatsapp")).toHaveText("1");
  await expect(page.getByTestId("clicks-telegram")).toHaveText("1");
  await expect(page.getByRole("row", { name: /Подвал сайта/ })).toContainText("1");
  await expect(page.getByRole("link", { name: "/kontakty" })).toBeVisible();

  // WhatsApp без бота: в «Обращениях» — вкладка со статистикой нажатий.
  await page.goto("/admin/obrashcheniya?channel=whatsapp");
  await expect(page.getByText("WhatsApp подключён как обычный аккаунт компании")).toBeVisible();
  await expect(page.getByTestId("wa-today")).toHaveText("1");
  await expect(page.getByTestId("wa-total")).toHaveText("1");
  await expect(page.getByRole("region", { name: "Где нажимали (30 дней)" })).toContainText("Подвал сайта");

  await context.close();
});
