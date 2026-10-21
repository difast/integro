import { expect, test, type Locator } from "@playwright/test";

/** Курсор мыши в фирменных цветах: стандартные формы, системная каретка в тексте и полях, файлы курсоров доступны. */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

const cursorOf = (locator: Locator) => locator.first().evaluate((el) => getComputedStyle(el).cursor);

test("стрелка и «рука» в фирменных цветах, каретка в тексте и полях ввода", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/kontakty");
  expect(await cursorOf(page.locator("body"))).toMatch(/cursors\/arrow(@2x)?\.(png|svg).*default/);
  expect(await cursorOf(page.locator("header a[href='/uslugi']"))).toMatch(/cursors\/pointer.*pointer/);
  expect(await cursorOf(page.locator("header a[href='/uslugi'] *, header a[href='/uslugi']"))).toMatch(/cursors\/pointer/);
  expect(await cursorOf(page.getByRole("button").filter({ visible: true }))).toMatch(/cursors\/pointer/);
  expect(await cursorOf(page.getByLabel("Как к вам обращаться"))).toBe("auto");
  expect(await cursorOf(page.getByLabel("Опишите задачу"))).toBe("auto");
  expect(await cursorOf(page.locator("main p"))).toBe("auto");
  expect(await cursorOf(page.getByLabel(/Даю согласие/))).toMatch(/cursors\/pointer/);
  // Кастомных элементов поверх страницы нет.
  expect(await page.locator(".custom-cursor").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("во всплывающей форме — те же курсоры", async ({ page }) => {
  await page.goto("/uslugi/ocenka");
  await page.getByRole("main").getByRole("link", { name: "Оставить заявку" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
  await expect(dialog).toBeVisible();
  expect(await cursorOf(dialog.getByRole("button"))).toMatch(/cursors\/pointer/);
  expect(await cursorOf(dialog.getByLabel("Как к вам обращаться"))).toBe("auto");
});

test("файлы курсоров отдаются сервером", async ({ request }) => {
  for (const file of ["arrow.svg", "arrow.png", "arrow@2x.png", "pointer.svg", "pointer.png", "pointer@2x.png"]) {
    const response = await request.get(`/cursors/${file}`);
    expect(response.status(), file).toBe(200);
  }
});
