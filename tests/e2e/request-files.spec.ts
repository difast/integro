import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_ADMIN_PASSWORD } from "../../playwright.config";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });

// Chromium в Linux без UTF-8 локали заменяет кириллическое имя скачиваемого файла на «download».
// Проверяем имя файла так, как его увидит пользователь с обычной системой.
test.use({ launchOptions: { env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } } });
// Свой адрес для ограничения частоты отправки (5 заявок с адреса), чтобы не расходовать общий лимит других тестов.
test.use({ extraHTTPHeaders: { "x-real-ip": "198.51.100.77" } });

const pdf = Buffer.from("%PDF-1.7\nАкт о заливе квартиры\n%%EOF\n");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

test.beforeAll(async () => {
  await db.connect();
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("SELECT to_regclass('public.request_files') AS t");
    if (rows[0].t) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.query("TRUNCATE admin_sessions, admin_login_attempts");
});

test.afterAll(async () => {
  await db.end();
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

async function fillContacts(scope: Page | Locator, name: string, prefix = "") {
  const field = (label: string | RegExp) => scope.getByLabel(label, { exact: typeof label === "string" ? false : undefined });
  await field("Как к вам обращаться").fill(name);
  await scope.locator(`#${prefix}phone`).fill("+7 999 765-43-21");
  await field("Опишите задачу").fill("Залив квартиры, прикладываю акт управляющей компании");
  await field(/Даю/).check();
}

test("форма «Контакты»: файлы необязательны, проверяются в браузере и сохраняются с заявкой", async ({ page, request }) => {
  const name = `Файлы ${Date.now()}`;
  await page.goto("/kontakty");
  const input = page.locator('form input[name="files"]');
  await expect(page.getByText("Прикрепить файлы")).toBeVisible();
  await expect(page.getByText("(необязательно)").first()).toBeVisible();

  // Запрещённый формат — ошибка сразу, без отправки.
  await input.setInputFiles({ name: "program.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await expect(page.getByText(/program\.exe» — неподдерживаемый формат/)).toBeVisible();

  // Два файла, один убираем.
  await input.setInputFiles([
    { name: "акт залива.pdf", mimeType: "application/pdf", buffer: pdf },
    { name: "кухня.jpg", mimeType: "image/jpeg", buffer: jpeg },
  ]);
  const selected = page.getByRole("list", { name: "Выбранные файлы" });
  await expect(selected.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText(/неподдерживаемый формат/)).toHaveCount(0);
  await page.getByRole("button", { name: "Убрать файл кухня.jpg" }).click();
  await expect(selected.getByRole("listitem")).toHaveCount(1);

  await fillContacts(page.locator("form").filter({ has: page.locator('input[name="files"]') }), name);
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Заявка отправлена")).toBeVisible();
  await expect(page.getByRole("list", { name: "Выбранные файлы" })).toHaveCount(0);

  const { rows } = await db.query(
    "SELECT r.id, f.id AS file_id, f.file_name, f.mime, f.size_bytes FROM requests r JOIN request_files f ON f.request_id = r.id WHERE r.name = $1",
    [name],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ file_name: "акт залива.pdf", mime: "application/pdf", size_bytes: pdf.length });
  const { id, file_id: fileId } = rows[0];

  // Без входа файл не отдаётся.
  const anonymous = await request.get(`/api/admin/requests/${id}/files/${fileId}`);
  expect(anonymous.status()).toBe(401);

  // В карточке заявки — файл и скачивание как вложение.
  await page.goto("/admin/vhod");
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin$/);
  await page.goto(`/admin/zayavki/${id}`);
  const section = page.getByRole("region", { name: "Файлы клиента (1)" });
  await expect(section).toContainText("акт залива.pdf");
  const download = await page.request.get(`/api/admin/requests/${id}/files/${fileId}`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toMatch(/^attachment;/);
  expect(download.headers()["content-disposition"]).toContain(encodeURIComponent("акт залива.pdf"));
  expect(download.headers()["x-content-type-options"]).toBe("nosniff");
  expect(Buffer.from(await download.body()).equals(pdf)).toBe(true);
  const [file] = await Promise.all([page.waitForEvent("download"), section.getByRole("link", { name: "Скачать акт залива.pdf" }).click()]);
  expect(file.suggestedFilename()).toBe("акт залива.pdf");
});

test("сервер отклоняет файл с подменённым содержимым и просит выбрать файлы заново", async ({ page }) => {
  const name = `Подмена ${Date.now()}`;
  await page.goto("/kontakty");
  const form = page.locator("form").filter({ has: page.locator('input[name="files"]') });
  await form.locator('input[name="files"]').setInputFiles({ name: "договор.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>не pdf</html>") });
  await fillContacts(form, name);
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText(/договор\.pdf» не похож на PDF/)).toBeVisible();
  await expect(page.getByText("Файлы нужно выбрать заново.", { exact: false })).toBeVisible();
  await expect(page.getByText("Заявка отправлена")).toHaveCount(0);
  await expect(page.getByLabel("Как к вам обращаться")).toHaveValue(name);
  const { rows } = await db.query("SELECT id FROM requests WHERE name = $1", [name]);
  expect(rows).toHaveLength(0);
});

test("всплывающее окно: заявка с файлом", async ({ page }) => {
  const name = `Окно ${Date.now()}`;
  await page.goto("/uslugi");
  await page.getByRole("main").getByRole("link", { name: "Оставить заявку" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
  await expect(dialog.getByText("Прикрепить файлы")).toBeVisible();
  await dialog.locator('input[name="files"]').setInputFiles({ name: "фото.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(dialog.getByRole("list", { name: "Выбранные файлы" })).toContainText("фото.jpg");
  await fillContacts(dialog, name, "rq-");
  await page.waitForTimeout(3_200);
  await dialog.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("heading", { name: "Заявка отправлена" })).toBeVisible();
  const { rows } = await db.query(
    "SELECT f.file_name FROM requests r JOIN request_files f ON f.request_id = r.id WHERE r.name = $1",
    [name],
  );
  expect(rows).toEqual([{ file_name: "фото.jpg" }]);
});

test("слишком большой файл отклоняется до отправки", async ({ page }) => {
  await page.goto("/kontakty");
  await page.locator('form input[name="files"]').setInputFiles({
    name: "скан.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(10 * 1024 * 1024)]),
  });
  await expect(page.getByText(/скан\.pdf» больше 10 МБ/)).toBeVisible();
});

test("крупная отправка в пределах лимитов (около 18 МБ) доходит до сервера", async ({ page }) => {
  const name = `Крупные ${Date.now()}`;
  const big = (i: number) => ({
    name: `скан-${i}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(6 * 1024 * 1024 - 9, 0x20)]),
  });
  await page.goto("/kontakty");
  const form = page.locator("form").filter({ has: page.locator('input[name="files"]') });
  await form.locator('input[name="files"]').setInputFiles([big(1), big(2), big(3)]);
  await fillContacts(form, name);
  await page.waitForTimeout(3_200);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Заявка отправлена")).toBeVisible({ timeout: 30_000 });
  const { rows } = await db.query(
    "SELECT count(*)::int AS n, sum(f.size_bytes)::int AS bytes FROM requests r JOIN request_files f ON f.request_id = r.id WHERE r.name = $1",
    [name],
  );
  expect(rows[0]).toEqual({ n: 3, bytes: 3 * 6 * 1024 * 1024 });
});
