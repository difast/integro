import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Файлы к заявке в PostgreSQL. Нужна отдельная тестовая база TEST_DATABASE_URL (таблицы очищаются).
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

type Db = typeof import("@/lib/db");
type Repo = typeof import("@/lib/requests/repository");
type Files = typeof import("@/lib/requests/files");
type Backup = typeof import("@/lib/backup/format");
let db: Db;
let repo: Repo;
let files: Files;
let backup: Backup;

const pdf = Buffer.from("%PDF-1.7\nтестовый документ\n");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

function input(submissionKey: string = randomUUID()) {
  return {
    submissionKey,
    name: "Иван Петров",
    phone: "+7 999 123-45-67",
    email: "",
    service: "ocenka",
    serviceTitle: "Оценочная деятельность",
    message: "Нужна оценка ущерба от залива, прикладываю акт",
    sourcePage: "/kontakty",
    context: null,
    consentRevision: "22.10.2026",
  };
}

/** Как в серверном действии формы: заявка и файлы — одной транзакцией, файлы только для новой заявки. */
async function submit(key: string, attached: { name: string; data: Buffer }[]) {
  const prepared = await files.prepareUploads(attached.map((f) => new File([new Uint8Array(f.data)], f.name)));
  if (!("files" in prepared)) throw new Error(prepared.error);
  return db.withTransaction(async (client) => {
    const result = await repo.createRequest(input(key), client);
    if (result.created && prepared.files.length > 0) await files.saveRequestFiles(client, result.id, prepared.files);
    return result;
  });
}

suite("request files database", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    repo = await import("@/lib/requests/repository");
    files = await import("@/lib/requests/files");
    backup = await import("@/lib/backup/format");
    await db.ensureSchema();
  });

  beforeEach(async () => {
    await db.query("TRUNCATE requests CASCADE");
  });

  afterAll(async () => {
    await db?.closePool();
  });

  it("сохраняет файлы вместе с заявкой и отдаёт их содержимое", async () => {
    const { id } = await submit(randomUUID(), [
      { name: "акт залива.pdf", data: pdf },
      { name: "кухня.jpg", data: jpeg },
    ]);
    const list = await files.listRequestFiles(id);
    expect(list.map((f) => [f.name, f.mime, f.size])).toEqual([
      ["акт залива.pdf", "application/pdf", pdf.length],
      ["кухня.jpg", "image/jpeg", jpeg.length],
    ]);
    const got = await files.getRequestFile(id, list[0]!.id);
    expect(got?.data.equals(pdf)).toBe(true);
  });

  it("заявка без файлов сохраняется как раньше", async () => {
    const { id, created } = await submit(randomUUID(), []);
    expect(created).toBe(true);
    expect(await files.listRequestFiles(id)).toEqual([]);
  });

  it("повторная отправка той же заявки не дублирует файлы", async () => {
    const key = randomUUID();
    const first = await submit(key, [{ name: "акт.pdf", data: pdf }]);
    const again = await submit(key, [{ name: "акт.pdf", data: pdf }]);
    expect(again).toEqual({ id: first.id, created: false });
    expect(await files.listRequestFiles(first.id)).toHaveLength(1);
  });

  it("при сбое сохранения файла заявка тоже не сохраняется", async () => {
    const key = randomUUID();
    await expect(
      db.withTransaction(async (client) => {
        const result = await repo.createRequest(input(key), client);
        // Нарушение ограничения таблицы (пустое имя) — транзакция откатывается целиком.
        await files.saveRequestFiles(client, result.id, [{ name: "", mime: "application/pdf", size: 3, sha256: "0".repeat(64), data: Buffer.from("abc") }]);
      }),
    ).rejects.toThrow();
    expect(await db.query("SELECT id FROM requests WHERE submission_key = $1", [key])).toHaveLength(0);
  });

  it("файл чужой заявки и неверные идентификаторы не отдаются", async () => {
    const a = await submit(randomUUID(), [{ name: "a.pdf", data: pdf }]);
    const b = await submit(randomUUID(), []);
    const fileId = (await files.listRequestFiles(a.id))[0]!.id;
    expect(await files.getRequestFile(b.id, fileId)).toBeNull();
    expect(await files.getRequestFile("not-a-uuid", fileId)).toBeNull();
    expect(await files.getRequestFile(a.id, "1 OR 1=1")).toBeNull();
  });

  it("файлы удаляются вместе с заявкой", async () => {
    const { id } = await submit(randomUUID(), [{ name: "a.pdf", data: pdf }]);
    expect(await repo.deleteRequest(id)).toBe(true);
    expect(await db.query("SELECT id FROM request_files")).toHaveLength(0);
  });

  it("восстановление из копии сайта сохраняет файлы заявок, которые есть в копии", async () => {
    const kept = await submit(randomUUID(), [{ name: "в копии.pdf", data: pdf }]);
    const { Client } = await import("pg");
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const dump = await backup.runDump(client);
      // Заявка после копии: при восстановлении исчезает вместе со своими файлами.
      const later = await submit(randomUUID(), [{ name: "после копии.jpg", data: jpeg }]);
      await backup.restoreTables(client, dump.data);
      expect((await files.listRequestFiles(kept.id)).map((f) => f.name)).toEqual(["в копии.pdf"]);
      expect(await files.listRequestFiles(later.id)).toEqual([]);
      expect((await files.getRequestFile(kept.id, (await files.listRequestFiles(kept.id))[0]!.id))?.data.equals(pdf)).toBe(true);
      // Нумерация файлов продолжается после восстановленных.
      const next = await submit(randomUUID(), [{ name: "новый.pdf", data: pdf }]);
      const ids = (await db.query<{ id: string }>("SELECT id FROM request_files ORDER BY id")).map((r) => Number(r.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(await files.listRequestFiles(next.id)).toHaveLength(1);
    } finally {
      await client.end();
    }
  });
});
