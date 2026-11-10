import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Маркетинговые ссылки в PostgreSQL. Нужна отдельная тестовая база TEST_DATABASE_URL. */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Repo = typeof import("@/lib/marketing/repository");
type Requests = typeof import("@/lib/requests/repository");
let db: Db;
let repo: Repo;
let requests: Requests;

suite("marketing links database", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    repo = await import("@/lib/marketing/repository");
    requests = await import("@/lib/requests/repository");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE requests CASCADE");
    await db.query("DELETE FROM marketing_link_clicks");
    await db.query("DELETE FROM marketing_links WHERE slug NOT IN ('threads', 'threads-vera')");
    await db.query("UPDATE marketing_links SET active = true");
  });

  afterAll(async () => {
    await db?.closePool();
  });

  const request = (attribution: Record<string, string> | null, stage?: string) =>
    requests
      .createRequest({
        submissionKey: randomUUID(),
        name: "Клиент",
        phone: "+7 999 000-00-00",
        email: "",
        service: "",
        serviceTitle: "Не выбрано",
        message: "Нужна консультация по оценке",
        sourcePage: "/kontakty",
        context: null,
        consentRevision: "22.10.2026",
        attribution,
      })
      .then(async ({ id }) => {
        if (stage) await db.query("UPDATE requests SET stage = $2, payment_status = 'paid', paid_amount = 15000 WHERE id = $1", [id, stage]);
        return id;
      });

  it("две ссылки Threads созданы миграцией: Вера (HR) и владелец", async () => {
    const vera = await repo.getActiveLinkBySlug("threads-vera");
    const owner = await repo.getActiveLinkBySlug("threads");
    expect(vera).toMatchObject({ title: "Threads — Вера (HR)", ownerLabel: "Вера, HR", utmSource: "threads" });
    expect(owner).toMatchObject({ title: "Threads — владелец", ownerLabel: "Владелец", utmSource: "threads" });
  });

  it("считает переходы и заявки отдельно по каждой ссылке", async () => {
    const vera = (await repo.getActiveLinkBySlug("threads-vera"))!;
    const owner = (await repo.getActiveLinkBySlug("threads"))!;
    for (let i = 0; i < 3; i++) await repo.recordLinkClick(vera.id);
    await repo.recordLinkClick(owner.id);
    await request({ utm_source: "threads", utm_medium: "social", utm_content: "threads-vera" }, "won");
    await request({ utm_source: "threads", utm_content: "threads" });
    await request({ utm_source: "vk", utm_content: "threads" }); // другая площадка — не считается
    await request(null);

    const stats = await repo.listLinkStats(30);
    const bySlug = Object.fromEntries(stats.map((s) => [s.slug, s]));
    expect(bySlug["threads-vera"]).toMatchObject({ clicks: 3, requests: 1, won: 1, paid: 15000 });
    expect(bySlug["threads"]).toMatchObject({ clicks: 1, requests: 1, won: 0, paid: 0 });
    const days = await repo.clicksByDay(30);
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(4);
  });

  it("новая ссылка с повторяющимся именем не создаётся; отключённая не находится", async () => {
    const link = { slug: "vk-vera", title: "VK — Вера", ownerLabel: "Вера", targetPath: "/", utmSource: "vk", utmMedium: "social", utmCampaign: "" };
    expect(await repo.createMarketingLink(link)).toBe("created");
    expect(await repo.createMarketingLink(link)).toBe("duplicate");
    const created = (await repo.getActiveLinkBySlug("vk-vera"))!;
    expect(await repo.setMarketingLinkActive(created.id, false)).toBe(true);
    expect(await repo.getActiveLinkBySlug("vk-vera")).toBeNull();
  });
});
