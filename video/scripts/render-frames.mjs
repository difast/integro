/**
 * Рендер кадров через редактор Motion Canvas в headless Chromium.
 * Требует запущенный `npm start` (vite на порту 9000) и установленный Playwright.
 * Использование: node scripts/render-frames.mjs [путь-к-playwright]
 */
import {createRequire} from "node:module";
import {existsSync, readdirSync, rmSync} from "node:fs";

const require = createRequire(import.meta.url);
const {chromium} = require(process.argv[2] ?? process.env.PW_PATH ?? "playwright");

const outDir = new URL("../output/project/", import.meta.url).pathname;
const expected = Number(process.env.FRAMES ?? 0);
if (existsSync(outDir)) rmSync(outDir, {recursive: true});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(process.env.EDITOR_URL ?? "http://localhost:9000/", {waitUntil: "networkidle"});
await page.waitForTimeout(3000);
await page.getByRole("button", {name: "Render", exact: true}).click();

const started = Date.now();
let last = -1;
let stableFor = 0;
for (;;) {
  await page.waitForTimeout(3000);
  const count = existsSync(outDir) ? readdirSync(outDir).filter((f) => /\.(jpe?g|png|webp)$/.test(f)).length : 0;
  process.stdout.write(`\rкадров: ${count}${expected ? "/" + expected : ""}  (${Math.round((Date.now() - started) / 1000)} с)`);
  if (expected && count >= expected) break;
  stableFor = count === last && count > 0 ? stableFor + 1 : 0;
  if (stableFor >= 4) break;
  last = count;
}
console.log("\nготово");
await browser.close();
