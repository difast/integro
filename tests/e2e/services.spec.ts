import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import { Client } from "pg";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
test.skip(!DATABASE_URL, "TEST_DATABASE_URL is not set");

const db = new Client({ connectionString: DATABASE_URL });

test.beforeAll(async () => {
  await db.connect();
});
test.afterAll(async () => {
  await db.end();
});
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("integro-cookie-notice", "accepted-v1"));
});

async function answer(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).check();
  await page.getByRole("button", { name: /Далее|Показать результат/ }).click();
}

test("помощник: результат, переход к заявке и контекст в сохранённой заявке", async ({ page }) => {
  await page.goto("/kakoy-dokument-nuzhen");
  await expect(page.getByRole("heading", { level: 1, name: "Какой документ мне нужен?" })).toBeVisible();
  await expect(page.getByText("Вопрос 1 из 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Далее" })).toBeDisabled();

  await answer(page, "Узнать рыночную или иную стоимость объекта");
  await answer(page, "Судебного дела пока нет");
  // Назад и смена ответа
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByLabel("Судебного дела пока нет")).toBeChecked();
  await page.getByRole("button", { name: "Далее" }).click();
  await answer(page, "Я сам или моя организация");
  // Последний вопрос подстроен под цель «стоимость»: варианта «залив» нет.
  await expect(page.getByLabel("Ущерб от залива или другого повреждения")).toHaveCount(0);
  await answer(page, "Квартира или другая недвижимость");

  await expect(page.getByRole("heading", { level: 2, name: /Вероятно, подойдёт: отчёт об оценке/ })).toBeVisible();
  await expect(page.getByText("не юридическое заключение")).toBeVisible();
  await expect(page.getByRole("link", { name: "Оценка квартиры" })).toHaveAttribute("href", "/uslugi/ocenka-kvartiry");

  // «Перейти к заявке» открывает всплывающую форму с предвыбранным направлением.
  await page.getByRole("link", { name: "Перейти к заявке" }).click();
  const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Направление")).toHaveValue("ocenka");
  await expect(dialog.getByLabel("Опишите задачу")).toHaveValue("");
  await expect(page).toHaveURL(/\/kakoy-dokument-nuzhen$/);

  const name = `Помощник ${Date.now()}`;
  await dialog.getByLabel("Как к вам обращаться").fill(name);
  await dialog.getByLabel("Эл. почта").fill("helper@example.ru");
  await dialog.getByLabel("Опишите задачу").fill("Оценка квартиры для нотариуса");
  await dialog.getByRole("checkbox").check();
  await page.waitForTimeout(3_200);
  await dialog.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("heading", { name: "Заявка отправлена" })).toBeVisible();

  const { rows } = await db.query("SELECT service, message, context, source_page FROM requests WHERE name = $1", [name]);
  expect(rows).toHaveLength(1);
  expect(rows[0].service).toBe("ocenka");
  expect(rows[0].message).toBe("Оценка квартиры для нотариуса");
  expect(rows[0].context).toBe(
    "Всплывающая форма; Помощник «Какой документ мне нужен?»: отчёт об оценке (квартира или другая недвижимость); Страница услуги: Оценка квартиры",
  );
  expect(rows[0].source_page).toMatch(/^\/kakoy-dokument-nuzhen\?/);
});

test("всплывающая форма: помещается в экран, закрывается, проверяет поля без запроса на сервер", async ({ page }) => {
  for (const size of [
    { width: 360, height: 640 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/uslugi/ocenka-biznesa");
    const posts: string[] = [];
    const onRequest = (request: { method: () => string; url: () => string }) => {
      if (request.method() === "POST") posts.push(request.url());
    };
    page.on("request", onRequest);

    await page.getByRole("main").getByRole("link", { name: "Оставить заявку" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Оставить заявку" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Как к вам обращаться")).toBeFocused();
    await expect(dialog.getByLabel("Направление")).toHaveValue("ocenka");

    // Даже со всеми ошибками окно помещается в экран без прокрутки.
    await dialog.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(dialog.getByText("Укажите, как к вам обращаться")).toBeVisible();
    const fits = await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight && el.getBoundingClientRect().bottom <= innerHeight);
    expect(fits).toBe(true);
    await page.waitForTimeout(300);
    expect(posts).toEqual([]);
    page.off("request", onRequest);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  // Мобильное меню: кнопка открывает окно и закрывает меню.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("link", { name: "Оставить заявку", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Оставить заявку" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Мобильная навигация" })).toBeHidden();

  // На странице «Контакты» кнопка в шапке ведёт к форме на странице, окно не открывается.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/kontakty");
  await page.getByRole("banner").getByRole("link", { name: "Оставить заявку" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/#zayavka$/);
});

test("помощник: управление с клавиатуры, консультация при противоречии, пройти заново", async ({ page }) => {
  await page.goto("/kakoy-dokument-nuzhen");
  const radio = page.getByLabel("Узнать рыночную или иную стоимость объекта");
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Вопрос 2 из 4")).toBeVisible();
  // Фокус переходит на заголовок нового вопроса.
  await expect(page.getByRole("heading", { level: 2, name: "Есть ли уже судебное дело?" })).toBeFocused();

  await answer(page, "Судебного дела пока нет");
  await answer(page, "Суд — документ нужен в рамках судебного дела");
  await answer(page, "Квартира или другая недвижимость");
  await expect(page.getByRole("heading", { level: 2, name: "Нужна консультация" })).toBeVisible();
  await expect(page.getByText(/судебного дела пока нет/).first()).toBeVisible();

  await page.getByRole("button", { name: "Пройти заново" }).click();
  await expect(page.getByText("Вопрос 1 из 4")).toBeVisible();
  await expect(page.getByLabel("Узнать рыночную или иную стоимость объекта")).not.toBeChecked();
});

test("форма: ошибки проверяются в браузере, без запроса на сервер и без потери данных", async ({ page }) => {
  await page.goto("/kontakty");
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  await page.getByLabel("Как к вам обращаться").fill("Тест Клиентской Проверки");
  await page.getByLabel("Телефон").fill("+7 999 abc 12 34 567");
  await page.getByLabel("Опишите задачу").fill("коротко");
  await page.getByRole("button", { name: "Отправить заявку" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Проверьте заполнение формы." })).toBeVisible();
  await expect(page.getByText("Проверьте номер телефона")).toBeVisible();
  await expect(page.getByText(/не менее 10 символов/)).toBeVisible();
  await expect(page.getByText("Необходимо согласие на обработку персональных данных")).toBeVisible();
  await expect(page.getByLabel("Телефон")).toBeFocused();
  await expect(page.getByLabel("Как к вам обращаться")).toHaveValue("Тест Клиентской Проверки");
  await page.waitForTimeout(500);
  expect(posts).toEqual([]);

  const { rows } = await db.query("SELECT count(*)::int AS n FROM requests WHERE name = $1", ["Тест Клиентской Проверки"]);
  expect(rows[0].n).toBe(0);

  // Ссылки на документы о персональных данных работают.
  for (const link of await page.getByRole("link", { name: /политике обработки персональных данных/ }).all()) {
    const href = await link.getAttribute("href");
    expect((await page.request.get(href!)).status()).toBe(200);
  }
});

test("шаблон ходатайства: свой кодекс для каждого вида производства, копирование и скачивание", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/dlya-yuristov");
  const preview = page.getByTestId("petition-text");

  await expect(preview).toContainText("статьёй 79 Гражданского процессуального кодекса");
  await expect(preview).not.toContainText("АПК");

  await page.getByLabel("Арбитражное судопроизводство").check();
  await expect(preview).toContainText("статьёй 82 Арбитражного процессуального кодекса");
  await expect(preview).toContainText("статья 108 АПК РФ");
  await expect(preview).not.toContainText("ГПК");
  await expect(page.getByText(/депозитный счёт арбитражного суда лицом, заявившим ходатайство/)).toBeVisible();

  await page.getByLabel("Административное судопроизводство").check();
  await expect(preview).toContainText("статьёй 77 Кодекса административного судопроизводства");
  await expect(preview).not.toContainText("АПК");
  await page.getByLabel("Процессуальный статус").selectOption("административный истец");

  await page.getByRole("textbox", { name: "Наименование суда" }).fill("Московский городской суд");
  await page.getByRole("textbox", { name: "Вопросы эксперту" }).fill("Какова стоимость объекта?\nКакие дефекты имеются?");
  await expect(preview).toContainText("В Московский городской суд");
  await expect(preview).toContainText("1. Какова стоимость объекта?");
  await expect(preview).toContainText("2. Какие дефекты имеются?");

  await page.getByRole("button", { name: "Копировать" }).click();
  await expect(page.getByRole("status").filter({ hasText: "скопирован" })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("В Московский городской суд");

  // Предпросмотр в новой вкладке: шапка справа, заголовок по центру.
  const [tab] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Предпросмотр" }).click()]);
  await tab.waitForLoadState();
  await expect(tab.locator(".addressee")).toContainText("В Московский городской суд");
  await expect(tab.locator(".title")).toHaveCSS("text-align", "center");
  expect(await tab.locator(".addressee").evaluate((el) => el.getBoundingClientRect().left > innerWidth / 3)).toBe(true);
  await tab.close();

  // Файл Word: правильная раскладка внутри document.xml.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Скачать Word" }).click()]);
  expect(download.suggestedFilename()).toBe("hodataystvo-o-naznachenii-ekspertizy.docx");
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).toContain("Московский городской суд");
  expect(xml).toContain("административный истец");
  expect(xml).toMatch(/<w:jc w:val="center"\/>/);
  expect(xml).toMatch(/<w:jc w:val="both"\/>/);
  expect(xml).toMatch(/<w:ind w:left="\d{4}"\/>/);
  expect(xml).toMatch(/<w:tab w:val="right"/);
  expect(await zip.file("word/styles.xml")!.async("string")).toContain("Times New Roman");

  // Печать вызывает системный диалог; проверяем, что кнопка вызывает window.print.
  await page.evaluate(() => {
    (window as unknown as { printed: boolean }).printed = false;
    window.print = () => {
      (window as unknown as { printed: boolean }).printed = true;
    };
  });
  await page.getByRole("button", { name: "Печать" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: boolean }).printed)).toBe(true);

  // Введённые данные не отправляются на сервер.
  const { rows } = await db.query("SELECT count(*)::int AS n FROM requests WHERE message LIKE '%Московский городской суд%'");
  expect(rows[0].n).toBe(0);
});

test("SEO-страницы: один H1, уникальные title и description, canonical, ссылка на заявку", async ({ page }) => {
  const slugs = ["ocenka-kvartiry", "ocenka-biznesa", "ocenka-ushcherba-ot-zaliva", "ocenka-avtomobilya", "stroitelno-tehnicheskaya-ekspertiza"];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const slug of slugs) {
    const response = await page.goto(`/uslugi/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    titles.add(await page.title());
    descriptions.add((await page.locator('meta[name="description"]').getAttribute("content"))!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://intsoftholding.ru/uslugi/${slug}`);
    await expect(page.getByRole("navigation", { name: "Навигационная цепочка" }).getByRole("link", { name: "Услуги" })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("link", { name: "Оставить заявку" }).first()).toHaveAttribute("href", `/kontakty?usluga=${slug}#zayavka`);
  }
  expect(titles.size).toBe(slugs.length);
  expect(descriptions.size).toBe(slugs.length);

  await page.goto("/kontakty?usluga=stroitelno-tehnicheskaya-ekspertiza");
  await expect(page.getByLabel("Направление")).toHaveValue("ekspertnye-issledovaniya");

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  for (const slug of slugs) expect(sitemap).toContain(`/uslugi/${slug}</loc>`);
  expect(sitemap).toContain("/dlya-yuristov</loc>");
  expect(sitemap).toContain("/kakoy-dokument-nuzhen</loc>");
});
