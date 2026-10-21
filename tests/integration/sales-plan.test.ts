import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** План продаж с базой PostgreSQL (TEST_DATABASE_URL). */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

let db: typeof import("@/lib/db");
let repo: typeof import("@/lib/sales-plan/repository");
let requests: typeof import("@/lib/requests/repository");

const values = (patch: Partial<import("@/lib/sales-plan/repository").PlanValues> = {}): import("@/lib/sales-plan/repository").PlanValues => ({
  revenuePlan: null,
  salesPlan: null,
  leadsPlan: null,
  revenueFact: null,
  salesFact: null,
  leadsFact: null,
  revenueSource: "auto",
  salesSource: "auto",
  leadsSource: "auto",
  ...patch,
});

async function request(patch: { service?: string; phone?: string; chatClientId?: string | null; createdAt?: string; payment?: { amount: string; at: string | null; currency?: string; status?: string } } = {}) {
  const { id } = await requests.createRequest({
    submissionKey: randomUUID(),
    name: "Клиент",
    phone: patch.phone ?? "",
    email: "",
    service: patch.service ?? "ocenka",
    serviceTitle: "Услуга",
    message: "Текст заявки",
    sourcePage: null,
    context: null,
    consentRevision: "test",
    chatClientId: patch.chatClientId ?? null,
    channel: patch.chatClientId ? "telegram" : "site",
  });
  if (patch.createdAt) await db.query("UPDATE requests SET created_at = $2 WHERE id = $1", [id, patch.createdAt]);
  if (patch.payment) {
    await db.query("UPDATE requests SET payment_status = $2, paid_amount = $3, paid_at = $4, currency = $5 WHERE id = $1", [
      id,
      patch.payment.status ?? "paid",
      patch.payment.amount,
      patch.payment.at,
      patch.payment.currency ?? "RUB",
    ]);
  }
  return id;
}

suite("план продаж и база", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    repo = await import("@/lib/sales-plan/repository");
    requests = await import("@/lib/requests/repository");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE sales_plans, request_history, requests, chat_clients RESTART IDENTITY CASCADE");
    await db.query(`UPDATE sales_directions SET title = CASE id WHEN 'ocenka' THEN 'Оценка' WHEN 'sud_zaklyuchenie' THEN 'Судебное заключение' ELSE 'Судебная экспертиза' END`);
  });

  afterAll(async () => {
    await db?.closePool();
  });

  it("три направления; новая заявка получает направление по услуге, без услуги — не получает", async () => {
    expect((await repo.listDirections()).map((d) => d.id)).toEqual(["ocenka", "sud_zaklyuchenie", "sud_ekspertiza"]);
    const a = await request({ service: "ocenka" });
    const b = await request({ service: "ekspertnye-issledovaniya" });
    const c = await request({ service: "sudebnaya-ekspertiza" });
    const d = await request({ service: "" });
    const direction = async (id: string) => (await requests.getRequest(id))!.directionId;
    expect([await direction(a), await direction(b), await direction(c), await direction(d)]).toEqual(["ocenka", "sud_zaklyuchenie", "sud_ekspertiza", null]);
    // Переименование направления не меняет привязку.
    await repo.saveDirectionTitles({ ocenka: "Оценка имущества" });
    expect((await repo.listDirections())[0]!.title).toBe("Оценка имущества");
    expect(await direction(a)).toBe("ocenka");
  });

  it("сохранение, повторное сохранение без дублей, независимость месяцев и направлений", async () => {
    const first = await repo.savePlans("2026-10", [{ directionId: "ocenka", version: null, values: values({ revenuePlan: 1_500_000, salesPlan: 30 }) }]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.saved.ocenka!.version).toBe(1);
    const second = await repo.savePlans("2026-10", [{ directionId: "ocenka", version: 1, values: values({ revenuePlan: 1_600_000, salesPlan: 30, leadsPlan: 100 }) }]);
    expect(second.ok && second.saved.ocenka!.version).toBe(2);
    await repo.savePlans("2026-11", [{ directionId: "ocenka", version: null, values: values({ revenuePlan: 2_000_000 }) }]);
    await repo.savePlans("2026-10", [{ directionId: "sud_ekspertiza", version: null, values: values({ salesPlan: 5, salesFact: 4, salesSource: "manual" }) }]);

    const oct = await repo.getPlans("2026-10");
    const nov = await repo.getPlans("2026-11");
    expect(oct.ocenka!.input).toMatchObject({ revenuePlan: "1600000", salesPlan: "30", leadsPlan: "100", revenueFact: null });
    expect(oct.sud_ekspertiza!.input).toMatchObject({ salesPlan: "5", salesFact: "4", salesSource: "manual" });
    expect(oct.sud_zaklyuchenie).toBeUndefined();
    expect(nov.ocenka!.input.revenuePlan).toBe("2000000");
    expect((await db.query("SELECT count(*)::int AS n FROM sales_plans")).at(0)).toEqual({ n: 3 });
    // Ноль сохраняется как ноль, пустое — как «не заполнено».
    await repo.savePlans("2026-12", [{ directionId: "ocenka", version: null, values: values({ salesFact: 0, salesSource: "manual" }) }]);
    expect((await repo.getPlans("2026-12")).ocenka!.input).toMatchObject({ salesFact: "0", revenueFact: null });
  });

  it("устаревшая версия: конфликт, ничего не сохраняется (в том числе другие направления)", async () => {
    await repo.savePlans("2026-10", [{ directionId: "ocenka", version: null, values: values({ revenuePlan: 100 }) }]);
    await repo.savePlans("2026-10", [{ directionId: "ocenka", version: 1, values: values({ revenuePlan: 200 }) }]); // другое окно
    const stale = await repo.savePlans("2026-10", [
      { directionId: "sud_ekspertiza", version: null, values: values({ revenuePlan: 999 }) },
      { directionId: "ocenka", version: 1, values: values({ revenuePlan: 300 }) },
    ]);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.conflicts.ocenka!.input.revenuePlan).toBe("200");
    const plans = await repo.getPlans("2026-10");
    expect(plans.ocenka!.input.revenuePlan).toBe("200");
    expect(plans.sud_ekspertiza).toBeUndefined();
    // Новая запись, созданная параллельно, тоже даёт конфликт, а не дубль.
    const dup = await repo.savePlans("2026-10", [{ directionId: "ocenka", version: null, values: values({ revenuePlan: 1 }) }]);
    expect(dup.ok).toBe(false);
    // Сброс: только с актуальной версией.
    expect(await repo.deletePlan("2026-10", "ocenka", 1)).toBe(false);
    expect(await repo.deletePlan("2026-10", "ocenka", 2)).toBe(true);
    expect((await repo.getPlans("2026-10")).ocenka).toBeUndefined();
  });

  it("база отклоняет отрицательные значения и неверный период", async () => {
    await expect(db.query("INSERT INTO sales_plans (period, direction_id, revenue_plan) VALUES ('2026-10-01', 'ocenka', -1)")).rejects.toThrow();
    await expect(db.query("INSERT INTO sales_plans (period, direction_id, leads_fact) VALUES ('2026-10-01', 'ocenka', -3)")).rejects.toThrow();
    await expect(db.query("INSERT INTO sales_plans (period, direction_id) VALUES ('2026-10-15', 'ocenka')")).rejects.toThrow();
  });

  it("автоматические факты: только оплаченные заявки месяца в рублях; лиды — уникальные клиенты; без выдуманных продаж", async () => {
    const [client] = await db.query<{ id: string }>("INSERT INTO chat_clients (channel, external_user_id, first_name) VALUES ('telegram', 1, 'А') RETURNING id");
    const oct = "2026-10-10T09:00:00Z";
    await request({ service: "ocenka", createdAt: oct, phone: "+7 900 000-00-01", payment: { amount: "100000", at: "2026-10-12" } });
    await request({ service: "ocenka", createdAt: oct, phone: "+7 900 000-00-02", payment: { amount: "50000", at: "2026-10-20", status: "partial" } });
    await request({ service: "ocenka", createdAt: oct, phone: "+7 900 000-00-02" }); // тот же клиент, вторая заявка — один лид
    await request({ service: "ocenka", createdAt: oct, chatClientId: client!.id });
    await request({ service: "ocenka", createdAt: oct, chatClientId: client!.id }); // несколько обращений одного клиента — один лид
    await request({ service: "ocenka", createdAt: "2026-09-20T09:00:00Z", payment: { amount: "70000", at: "2026-10-02" } }); // заявка сентября, оплата октября
    await request({ service: "ocenka", createdAt: oct, payment: { amount: "1000", at: "2026-10-05", currency: "USD" } });
    await request({ service: "ocenka", createdAt: oct, payment: { amount: "5000", at: null } });
    await request({ service: "ocenka", createdAt: oct, payment: { amount: "8000", at: "2026-11-01" } }); // оплата ноября
    await request({ service: "sudebnaya-ekspertiza", createdAt: oct, payment: { amount: "300000", at: "2026-10-15" } });
    await request({ service: "", createdAt: oct, payment: { amount: "40000", at: "2026-10-15" } }); // без направления
    // Граница месяца по Москве: 31.10 23:30 МСК — ещё октябрь.
    await request({ service: "sudebnaya-ekspertiza", createdAt: "2026-10-31T20:30:00Z" });

    const facts = await repo.getAutoFacts("2026-10");
    expect(facts.byDirection.ocenka).toMatchObject({ revenue: 220_000, sales: 3, paidWithoutDate: 1, paidNonRub: 1 });
    // Лиды октября по оценке: телефон 01, телефон 02 (2 заявки), клиент Telegram (2 заявки), USD, без даты, ноябрьская оплата = 6.
    expect(facts.byDirection.ocenka!.leads).toBe(6);
    expect(facts.byDirection.ocenka!.leadsByChannel).toEqual({ site: 5, telegram: 1 });
    expect(facts.byDirection.sud_ekspertiza).toMatchObject({ revenue: 300_000, sales: 1, leads: 2 });
    expect(facts.byDirection.sud_zaklyuchenie).toBeUndefined();
    expect(facts.unclassified).toEqual({ leads: 1, paid: 1 });

    const history = await repo.getHistory("2026-11", 3);
    expect(history.map((m) => m.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(history[1]!.auto.ocenka).toMatchObject({ revenue: 220_000, sales: 3, leads: 6 });
    expect(history[2]!.auto.ocenka).toMatchObject({ revenue: 8_000, sales: 1 });
    expect(history[0]!.auto.ocenka).toMatchObject({ leads: 1, sales: 0 });
  });
});
