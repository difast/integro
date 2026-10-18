import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Работа с PostgreSQL. Нужна отдельная тестовая база: TEST_DATABASE_URL
 * (все таблицы в ней очищаются). Без переменной тесты пропускаются.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Repo = typeof import("@/lib/requests/repository");
type Sessions = typeof import("@/lib/admin/session-store");
let db: Db;
let repo: Repo;
let sessions: Sessions;

function sample(overrides: Partial<Parameters<Repo["createRequest"]>[0]> = {}) {
  return {
    submissionKey: randomUUID(),
    name: "Иван Петров",
    phone: "+7 999 123-45-67",
    email: "ivan@example.ru",
    service: "ocenka",
    serviceTitle: "Оценочная деятельность",
    message: "Нужна оценка квартиры для нотариуса",
    sourcePage: "/kontakty?usluga=ocenka",
    context: null,
    consentRevision: "16.10.2026",
    ...overrides,
  };
}

suite("requests database", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    repo = await import("@/lib/requests/repository");
    sessions = await import("@/lib/admin/session-store");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE requests, admin_sessions, admin_login_attempts");
  });

  afterAll(async () => {
    await db?.closePool();
  });

  it("applies migrations idempotently", async () => {
    await db.closePool();
    await db.ensureSchema();
    const rows = await db.query<{ id: string }>("SELECT id FROM schema_migrations");
    expect(rows.map((row) => row.id)).toContain("001_requests_and_admin");
  });

  it("creates a request with status new and does not duplicate the same submission", async () => {
    const input = sample();
    const first = await repo.createRequest(input);
    const second = await repo.createRequest(input);
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });

    const stored = await repo.getRequest(first.id);
    expect(stored).toMatchObject({ name: "Иван Петров", status: "new", notes: "", sourcePage: "/kontakty?usluga=ocenka" });
    expect((await repo.countRequests()).total).toBe(1);
  });

  it("handles concurrent double submission", async () => {
    const input = sample();
    const results = await Promise.all([repo.createRequest(input), repo.createRequest(input), repo.createRequest(input)]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect((await repo.countRequests()).total).toBe(1);
  });

  it("rejects invalid data at the database level", async () => {
    await expect(repo.createRequest(sample({ name: "x".repeat(101) }))).rejects.toThrow();
    await expect(db.query("UPDATE requests SET status = 'hacked'")).resolves.toEqual([]);
    const { id } = await repo.createRequest(sample());
    await expect(db.query("UPDATE requests SET status = 'hacked' WHERE id = $1", [id])).rejects.toThrow();
  });

  it("searches by name, phone and email and filters by status", async () => {
    const a = await repo.createRequest(sample({ name: "Анна Смирнова", phone: "8 (916) 555-11-22", email: "anna@mail.ru" }));
    await repo.createRequest(sample({ name: "Олег 100%", phone: "", email: "oleg@firma.ru" }));
    await repo.updateRequest(a.id, { status: "done", notes: "" });

    const list = (q: string, status: "done" | null = null) =>
      repo.listRequests({ q, status, sort: "new", page: 1 }).then((result) => result.items.map((item) => item.name));

    expect(await list("смирн")).toEqual(["Анна Смирнова"]);
    expect(await list("+7 916 555 11 22")).toEqual(["Анна Смирнова"]);
    expect(await list("555-11")).toEqual(["Анна Смирнова"]);
    expect(await list("FIRMA.RU")).toEqual(["Олег 100%"]);
    expect(await list("100%")).toEqual(["Олег 100%"]);
    expect(await list("%")).toEqual(["Олег 100%"]);
    expect(await list("", "done")).toEqual(["Анна Смирнова"]);
    expect(await list("олег", "done")).toEqual([]);
  });

  it("sorts by creation date", async () => {
    const first = await repo.createRequest(sample({ name: "Первый" }));
    const second = await repo.createRequest(sample({ name: "Второй" }));
    await db.query("UPDATE requests SET created_at = now() - interval '1 day' WHERE id = $1", [first.id]);
    const newest = await repo.listRequests({ q: "", status: null, sort: "new", page: 1 });
    const oldest = await repo.listRequests({ q: "", status: null, sort: "old", page: 1 });
    expect(newest.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(oldest.items.map((item) => item.id)).toEqual([first.id, second.id]);
  });

  it("updates status and notes, deletes requests", async () => {
    const { id } = await repo.createRequest(sample());
    expect(await repo.updateRequest(id, { status: "waiting_client", notes: "Перезвонить в пятницу" })).toBe(true);
    expect(await repo.getRequest(id)).toMatchObject({ status: "waiting_client", notes: "Перезвонить в пятницу" });
    expect(await repo.deleteRequest(id)).toBe(true);
    expect(await repo.getRequest(id)).toBeNull();
    expect(await repo.updateRequest(id, { status: "done", notes: "" })).toBe(false);
    expect(await repo.getRequest("not-a-uuid")).toBeNull();
  });

  it("stores only token hashes for sessions and expires them", async () => {
    const { token } = await sessions.createSession();
    expect(await sessions.isSessionValid(token)).toBe(true);
    const stored = await db.query<{ token_hash: string }>("SELECT token_hash FROM admin_sessions");
    expect(stored[0]?.token_hash).not.toBe(token);
    expect(stored[0]?.token_hash).toBe(sessions.hashToken(token));

    expect(await sessions.isSessionValid("forged-token")).toBe(false);
    await db.query("UPDATE admin_sessions SET expires_at = now() - interval '1 second'");
    expect(await sessions.isSessionValid(token)).toBe(false);

    const next = await sessions.createSession();
    await sessions.deleteSession(next.token);
    expect(await sessions.isSessionValid(next.token)).toBe(false);
  });

  it("blocks login after repeated failures per client and globally", async () => {
    for (let i = 0; i < sessions.MAX_FAILED_PER_CLIENT; i++) {
      expect(await sessions.isLoginBlocked("10.0.0.1")).toBe(false);
      await sessions.recordFailedLogin("10.0.0.1");
    }
    expect(await sessions.isLoginBlocked("10.0.0.1")).toBe(true);
    expect(await sessions.isLoginBlocked("10.0.0.2")).toBe(false);

    await sessions.clearFailedLogins("10.0.0.1");
    expect(await sessions.isLoginBlocked("10.0.0.1")).toBe(false);

    for (let i = 0; i < sessions.MAX_FAILED_TOTAL; i++) await sessions.recordFailedLogin(`10.1.0.${i}`);
    expect(await sessions.isLoginBlocked("10.9.9.9")).toBe(true);

    const raw = await db.query<{ client_hash: string }>("SELECT client_hash FROM admin_login_attempts LIMIT 1");
    expect(raw[0]?.client_hash).not.toContain("10.1.0");
  });
});
