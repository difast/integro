import { describe, expect, it } from "vitest";
import { isBotUserAgent, normalizeClickPath, parseClickEvent, parseStatsPeriod } from "@/lib/stats/clicks";

describe("parseClickEvent", () => {
  it("принимает допустимое событие и убирает параметры из пути", () => {
    expect(parseClickEvent({ messenger: "whatsapp", placement: "footer", path: "/kontakty?usluga=ocenka#forma" })).toEqual({
      messenger: "whatsapp",
      placement: "footer",
      path: "/kontakty",
    });
  });

  it("отклоняет неизвестные мессенджеры, места и лишние типы", () => {
    expect(parseClickEvent({ messenger: "viber", placement: "footer", path: "/" })).toBeNull();
    expect(parseClickEvent({ messenger: "telegram", placement: "sidebar", path: "/" })).toBeNull();
    expect(parseClickEvent({ messenger: ["telegram"], placement: "footer", path: "/" })).toBeNull();
    expect(parseClickEvent(null)).toBeNull();
    expect(parseClickEvent("whatsapp")).toBeNull();
  });
});

describe("normalizeClickPath", () => {
  it("оставляет только путь на этом сайте", () => {
    expect(normalizeClickPath("/")).toBe("/");
    expect(normalizeClickPath("/uslugi/ocenka")).toBe("/uslugi/ocenka");
    expect(normalizeClickPath("https://evil.example/")).toBeNull();
    expect(normalizeClickPath("//evil.example/")).toBeNull();
    expect(normalizeClickPath("/a b")).toBeNull();
    expect(normalizeClickPath("/<script>")).toBeNull();
    expect(normalizeClickPath(`/${"a".repeat(200)}`)).toBeNull();
    expect(normalizeClickPath(42)).toBeNull();
  });
});

describe("isBotUserAgent", () => {
  it("отсекает роботов и пустой User-Agent", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; YandexBot/3.0)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 YaBrowser/24.1 Mobile Safari/604.1")).toBe(false);
  });
});

describe("parseStatsPeriod", () => {
  it("по умолчанию — 30 дней", () => {
    expect(parseStatsPeriod(undefined).days).toBe(30);
    expect(parseStatsPeriod("bogus").days).toBe(30);
    expect(parseStatsPeriod("7").days).toBe(7);
    expect(parseStatsPeriod("all").days).toBeNull();
  });
});
