import { expect, test } from "@playwright/test";
import { Client } from "pg";

/** Карта субъектов РФ на главной: полнота, интерактивность, анимация, reduced motion, заявка с регионом, телефон. */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

const REQUIRED = [
  "Калининградская область",
  "Республика Крым",
  "Севастополь",
  "Москва",
  "Московская область",
  "Санкт-Петербург",
  "Чукотский автономный округ",
  "Сахалинская область",
  "Камчатский край",
  "Донецкая Народная Республика",
  "Луганская Народная Республика",
  "Запорожская область",
  "Херсонская область",
  "Республика Саха (Якутия)",
];

test("89 субъектов: у каждого свой контур, название и отклик на нажатие; список совпадает с картой", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  const map = page.getByTestId("russia-map");
  const regions = await map.locator("path[data-id]").evaluateAll((paths) =>
    paths.map((p) => {
      const box = (p as SVGGraphicsElement).getBBox();
      return { id: p.getAttribute("data-id")!, name: p.getAttribute("data-name")!, w: box.width, h: box.height };
    }),
  );
  expect(regions).toHaveLength(89);
  expect(new Set(regions.map((r) => r.id)).size).toBe(89);
  expect(new Set(regions.map((r) => r.name)).size).toBe(89);
  for (const r of regions) expect(r.w * r.h, r.name).toBeGreaterThan(0);
  for (const name of REQUIRED) expect(regions.map((r) => r.name)).toContain(name);
  const options = await page.getByLabel("Ваш регион").locator("option[value^='RU-']").allTextContents();
  expect(options.sort()).toEqual(regions.map((r) => r.name).sort());

  // Каждый контур реагирует на нажатие (включая самые маленькие — Москву, Севастополь, Санкт-Петербург).
  await page.locator("#geography-title").scrollIntoViewIfNeeded();
  for (const r of regions) {
    await map.locator(`path[data-id="${r.id}"]`).dispatchEvent("click");
    await expect(page.getByTestId("russia-map-info")).toContainText(r.name);
    await expect(map.locator("path[data-selected]")).toHaveAttribute("data-id", r.id);
  }
  expect(errors).toEqual([]);
});

test("анимация при появлении блока; подсказка при наведении; выбор кликом мышью", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const map = page.getByTestId("russia-map");
  await expect(map).toHaveAttribute("data-reveal", "pending");
  await page.locator("#geography-title").scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("data-reveal", "in");
  await expect(map).toHaveAttribute("data-reveal", "done", { timeout: 6_000 });
  // Повторное появление блока — карта остаётся закрашенной, анимация не повторяется.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("#geography-title").scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("data-reveal", "done");

  const yakutia = (await map.locator('path[data-id="RU-SA"]').boundingBox())!;
  await page.mouse.move(yakutia.x + yakutia.width / 2, yakutia.y + yakutia.height / 2);
  await expect(page.getByRole("tooltip")).toHaveText("Республика Саха (Якутия)");
  await page.mouse.click(yakutia.x + yakutia.width / 2, yakutia.y + yakutia.height / 2);
  await expect(page.getByTestId("russia-map-info")).toContainText("Из этого региона можно обратиться");
  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toBeHidden();
});

test("prefers-reduced-motion: карта сразу закрашена, без анимации", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const map = page.getByTestId("russia-map");
  await expect(map).toHaveAttribute("data-reveal", "done");
  const transition = await map.locator("path").first().evaluate((p) => getComputedStyle(p).transitionDuration);
  expect(transition).toBe("0s");
  await context.close();
});

test("заявка из карточки региона: регион попадает в контекст заявки", async ({ page }) => {
  const url = process.env.TEST_DATABASE_URL;
  test.skip(!url, "TEST_DATABASE_URL is not set");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await page.goto("/");
    await page.getByLabel("Ваш регион").selectOption("RU-KGD");
    await page.getByTestId("russia-map-info").getByRole("link", { name: "Оставить заявку" }).click();
    const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Как к вам обращаться").fill("Клиент из Калининграда");
    await dialog.getByLabel("Телефон").fill("+7 911 000-00-39");
    await dialog.getByLabel("Опишите задачу").fill("Нужна оценка квартиры в Калининграде");
    await dialog.getByLabel(/Даю согласие|согласие/).first().check();
    await page.waitForTimeout(3_200);
    await dialog.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByRole("heading", { name: "Заявка отправлена" })).toBeVisible();
    const { rows } = await db.query("SELECT context FROM requests WHERE name = 'Клиент из Калининграда' ORDER BY created_at DESC LIMIT 1");
    expect(rows[0].context).toContain("Регион на карте: Калининградская область");
  } finally {
    await db.end();
  }
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  test("карта целиком в ширину экрана, нажатие на регион, без горизонтальной прокрутки", async ({ page }) => {
    await page.goto("/");
    await page.locator("#geography-title").scrollIntoViewIfNeeded();
    const map = page.getByTestId("russia-map");
    const box = (await map.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await expect(map).toHaveAttribute("data-reveal", "done", { timeout: 6_000 });
    const region = (await map.locator('path[data-id="RU-KYA"]').boundingBox())!;
    await page.touchscreen.tap(region.x + region.width / 2, region.y + region.height * 0.6);
    await expect(page.getByTestId("russia-map-info")).toContainText("Красноярский край");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
