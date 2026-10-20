import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseAnalyticsFilters, ratio, filtersToSearch, formatPercent } from "@/lib/analytics/filters";
import { decryptBackup, encryptBackup, parseBackupKey } from "@/lib/backup/format";
import { signRequest } from "@/lib/backup/s3";
import { externalText } from "@/lib/notifications/texts";
import { notificationTypes } from "@/lib/ops/settings";
import { safeMessage } from "@/lib/ops/monitor";
import { describeAttribution, parseAttribution } from "@/lib/requests/attribution";
import { parseDate, parseMoney } from "@/lib/requests/parse";
import { analyticsRequestsToCsv } from "@/lib/analytics/csv";

describe("атрибуция заявки (UTM)", () => {
  it("берёт только известные ключи и безопасные значения", () => {
    const raw = JSON.stringify({ utm_source: "yandex", utm_medium: "cpc", utm_campaign: "ocenka-2026", referrer: "ya.ru", landing: "/uslugi/ocenka", evil: "x" });
    expect(parseAttribution(raw)).toEqual({ utm_source: "yandex", utm_medium: "cpc", utm_campaign: "ocenka-2026", referrer: "ya.ru", landing: "/uslugi/ocenka" });
  });
  it("отбрасывает разметку, неверный JSON и неверные домены", () => {
    expect(parseAttribution("{bad")).toBeNull();
    expect(parseAttribution(JSON.stringify({ utm_source: "<script>" }))).toBeNull();
    expect(parseAttribution(JSON.stringify({ referrer: "javascript:alert(1)", landing: "https://evil" }))).toBeNull();
    expect(parseAttribution("x".repeat(3000))).toBeNull();
  });
  it("без данных источник — «Не определён»", () => {
    expect(describeAttribution(null)).toBe("Не определён");
    expect(describeAttribution({ referrer: "google.com" })).toBe("Переход с google.com");
    expect(describeAttribution({ landing: "/" })).toBe("Прямой заход");
  });
});

describe("суммы и даты из форм", () => {
  it("parseMoney", () => {
    expect(parseMoney("12 345,5")).toBe("12345.50");
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("-5")).toBe("bad");
    expect(parseMoney("1.234")).toBe("bad");
    expect(parseMoney("1e5")).toBe("bad");
  });
  it("parseDate", () => {
    expect(parseDate("2026-02-28")).toBe("2026-02-28");
    expect(parseDate("2026-02-30")).toBe("bad");
    expect(parseDate("1999-01-01")).toBe("bad");
    expect(parseDate(null)).toBeNull();
  });
});

describe("журнал ошибок без секретов", () => {
  it("маскирует токены", () => {
    const text = safeMessage("fetch https://api.telegram.org/bot123456:AAH-abcdefghijklmnopqrstuvwxyz/sendMessage token=abc secret: s3cr3t");
    expect(text).not.toContain("AAH-abc");
    expect(text).not.toContain("s3cr3t");
    expect(text).not.toContain("token=abc");
  });
});

describe("тексты push и Telegram без персональных данных", () => {
  it("не зависят от данных клиента и не содержат их", () => {
    for (const type of notificationTypes) {
      const text = externalText(type.value, "telegram");
      expect(text.title.length).toBeGreaterThan(0);
      expect(`${text.title} ${text.body}`).not.toMatch(/\+7|\d{10}|@/);
    }
  });
});

describe("резервные копии", () => {
  it("шифрование AES-256-GCM: расшифровка тем же ключом, отказ при чужом ключе и порче", () => {
    const key = randomBytes(32);
    const plain = Buffer.from("строки базы");
    const file = encryptBackup(plain, key);
    expect(file.includes(plain)).toBe(false);
    expect(decryptBackup(file, key).toString()).toBe("строки базы");
    expect(() => decryptBackup(file, randomBytes(32))).toThrow(/неверный ключ/);
    const broken = Buffer.from(file);
    broken[broken.length - 20]! ^= 1;
    expect(() => decryptBackup(broken, key)).toThrow();
    expect(() => decryptBackup(Buffer.from("not a backup file at all, definitely"), key)).toThrow(/не файл/);
  });
  it("ключ: 64 hex или 32 байта base64", () => {
    expect(parseBackupKey("ab".repeat(32))?.length).toBe(32);
    expect(parseBackupKey(randomBytes(32).toString("base64"))?.length).toBe(32);
    expect(parseBackupKey("short")).toBeNull();
    expect(parseBackupKey(undefined)).toBeNull();
  });
  it("подпись S3 SigV4 совпадает с примером из документации AWS (GET Object)", () => {
    const headers = signRequest({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      headers: { Range: "bytes=0-9" },
      date: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });
});

describe("фильтры аналитики", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("по умолчанию — последние 30 дней по Москве", () => {
    const f = parseAnalyticsFilters({}, now);
    expect(f).toMatchObject({ from: "2026-09-21", to: "2026-10-20", channel: null, stage: null });
  });
  it("неверные значения игнорируются, границы меняются местами", () => {
    const f = parseAnalyticsFilters({ from: "2026-10-10", to: "2026-10-01", channel: "fax", stage: "won", lossReason: "1;drop", payment: "paid" }, now);
    expect(f).toMatchObject({ from: "2026-10-01", to: "2026-10-10", channel: null, stage: "won", lossReason: null, payment: "paid" });
    expect(parseAnalyticsFilters({ from: "2026-02-31" }, now).from).toBe("2026-09-21");
    expect(filtersToSearch(f)).toBe("from=2026-10-01&to=2026-10-10&stage=won&payment=paid");
  });
  it("доля при нулевом знаменателе не равна 0 %", () => {
    expect(ratio(0, 0).value).toBeNull();
    expect(formatPercent(ratio(0, 0))).toBe("—");
    expect(formatPercent(ratio(1, 3))).toBe("33,3 %");
  });
  it("CSV аналитики защищён от формул и не содержит ПДн-столбцов", () => {
    const csv = analyticsRequestsToCsv([
      {
        id: "0b2f3c4d-0000-4000-8000-000000000000",
        createdAt: new Date("2026-10-01T09:00:00Z"),
        channel: "whatsapp",
        serviceTitle: "Оценка",
        status: "new",
        stage: "lost",
        lossReason: "Цена",
        assignee: "=HYPERLINK(\"x\")",
        dealAmount: null,
        currency: "RUB",
        paymentStatus: "none",
        paidAmount: null,
        paidAt: null,
        attribution: null,
      },
    ]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).not.toMatch(/Телефон|Имя|E-mail/);
    expect(csv).toContain("0B2F3C4D");
  });
});
