import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Статистика переходов в мессенджеры. Нужна тестовая база TEST_DATABASE_URL. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Stats = typeof import("@/lib/stats/repository");
let db: Db;
let stats: Stats;

suite("messenger clicks", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    stats = await import("@/lib/stats/repository");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE messenger_clicks");
  });

  afterAll(async () => {
    await db?.closePool();
  });

  it("считает переходы по мессенджерам, местам и страницам", async () => {
    await stats.recordClick({ messenger: "whatsapp", placement: "header", path: "/" });
    await stats.recordClick({ messenger: "whatsapp", placement: "footer", path: "/kontakty" });
    await stats.recordClick({ messenger: "telegram", placement: "footer", path: "/kontakty" });

    const result = await stats.getClickStats(30);
    expect(result.total).toBe(3);
    expect(result.byMessenger).toEqual({ whatsapp: 2, telegram: 1 });
    expect(result.byPlacement).toContainEqual({ placement: "footer", messenger: "whatsapp", count: 1 });
    expect(result.topPages[0]).toEqual({ path: "/kontakty", count: 2 });
    expect(result.byDay.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });

  it("учитывает период", async () => {
    await stats.recordClick({ messenger: "telegram", placement: "contacts", path: "/kontakty" });
    await db.query(
      "INSERT INTO messenger_clicks (messenger, placement, page_path, created_at) VALUES ('whatsapp', 'footer', '/', now() - interval '40 days')",
    );

    expect((await stats.getClickStats(7)).total).toBe(1);
    expect((await stats.getClickStats(30)).byMessenger).toEqual({ telegram: 1 });
    expect((await stats.getClickStats(null)).total).toBe(2);
  });

  it("база отклоняет недопустимые значения", async () => {
    await expect(
      db.query("INSERT INTO messenger_clicks (messenger, placement, page_path) VALUES ('viber', 'footer', '/')"),
    ).rejects.toThrow();
  });
});
