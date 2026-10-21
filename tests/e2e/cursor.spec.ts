import { expect, test, type Page } from "@playwright/test";

/** Кастомный курсор публичной части: появление, состояния, поля ввода, модальное окно, сенсорные устройства, reduced motion. */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

const cursor = (page: Page) => page.locator(".custom-cursor");
const hasClass = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("has-custom-cursor"));
const dotPosition = (page: Page) =>
  page.evaluate(() => {
    const m = getComputedStyle(document.querySelector(".custom-cursor__dot")!).transform;
    const v = new DOMMatrixReadOnly(m);
    return { x: Math.round(v.m41), y: Math.round(v.m42) };
  });

test.describe("мышь", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("появляется только после движения мыши, точка под указателем, кольцо догоняет, без ошибок в консоли", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    expect(await hasClass(page)).toBe(false);
    await expect(cursor(page)).toBeHidden();
    // До движения системный курсор не скрыт.
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe("none");

    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    expect(await hasClass(page)).toBe(true);
    await expect(cursor(page)).toHaveAttribute("data-visible", "true");
    expect(await dotPosition(page)).toEqual({ x: 420, y: 320 });
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe("none");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const v = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".custom-cursor__ring")!).transform);
          return Math.round(v.m41);
        }),
      )
      .toBe(420);
    expect(await page.locator(".custom-cursor").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    expect(errors).toEqual([]);
  });

  test("наведение на ссылку и кнопку, нажатие, карточка, поле ввода, переход на другую страницу", async ({ page }) => {
    await page.goto("/kontakty");
    await page.mouse.move(10, 400);
    const at = async (selector: string | ReturnType<Page["locator"]>) => {
      const target = (typeof selector === "string" ? page.locator(selector) : selector).filter({ visible: true }).first();
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    };
    await at("header a[href='/uslugi']");
    await expect(cursor(page)).toHaveAttribute("data-state", "hover");
    await page.mouse.down();
    await expect(cursor(page)).toHaveAttribute("data-pressed", "true");
    // Отпускаем в стороне от ссылки, чтобы не было перехода.
    await page.mouse.move(640, 600, { steps: 3 });
    await page.mouse.up();
    await expect(cursor(page)).toHaveAttribute("data-pressed", "false");

    // Поле ввода: системный курсор с кареткой, кастомный скрыт.
    const field = page.getByLabel("Как к вам обращаться");
    await at(field);
    await expect(cursor(page)).toHaveAttribute("data-state", "native");
    await expect(cursor(page)).toHaveAttribute("data-visible", "false");
    const fieldCursor = await field.evaluate((el) => getComputedStyle(el).cursor);
    expect(fieldCursor).toBe("auto");
    await at("main h1");
    await expect(cursor(page)).toHaveAttribute("data-state", "default");
    await expect(cursor(page)).toHaveAttribute("data-visible", "true");

    // Крупная кликабельная карточка (статьи на главной).
    await page.goto("/");
    await page.mouse.move(5, 5);
    const card = page.locator("main a").filter({ has: page.locator("h3") }).first();
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(cursor(page)).toHaveAttribute("data-state", "card");

    // Клиентский переход: курсор остаётся рабочим, состояние сбрасывается.
    await card.click();
    await page.waitForURL(/\/stati\/|\/uslugi\//);
    await expect(cursor(page)).toHaveAttribute("data-state", "default");
    await page.mouse.move(300, 300);
    expect(await hasClass(page)).toBe(true);
  });

  test("в модальном окне заявки — системный курсор", async ({ page }) => {
    await page.goto("/uslugi/ocenka");
    await page.mouse.move(200, 200);
    await page.getByRole("main").getByRole("link", { name: "Оставить заявку" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40, { steps: 3 });
    await expect(cursor(page)).toHaveAttribute("data-visible", "false");
    expect(await dialog.evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
    expect(await dialog.getByRole("button").first().evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
    expect(await dialog.getByLabel("Как к вам обращаться").evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
  });

  test("prefers-reduced-motion: кастомный курсор не включается", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 330);
    expect(await hasClass(page)).toBe(false);
    await expect(cursor(page)).toBeHidden();
  });
});

test.describe("сенсорный экран", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("не отображается и не мешает нажатиям", async ({ page }) => {
    await page.goto("/");
    await page.tap("header a");
    expect(await hasClass(page)).toBe(false);
    await expect(cursor(page)).toBeHidden();
  });
});
