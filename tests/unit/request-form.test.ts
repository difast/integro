import { describe, expect, it } from "vitest";
import { validateRequest } from "@/lib/request-form";
import { describeRequestContext } from "@/lib/requests/context";

const ok = { name: "Иван", phone: "+7 (999) 123-45-67", email: "", message: "Нужна оценка квартиры" };

describe("validateRequest", () => {
  it("accepts a valid request", () => {
    expect(validateRequest(ok, true)).toEqual({});
    expect(validateRequest({ ...ok, phone: "", email: "ivan@example.ru" }, true)).toEqual({});
  });

  it("requires name, contact, message and consent", () => {
    const errors = validateRequest({ name: "И", phone: "", email: "", message: "коротко" }, false);
    expect(Object.keys(errors).sort()).toEqual(["consent", "message", "name", "phone"]);
  });

  it("checks phone characters and length", () => {
    expect(validateRequest({ ...ok, phone: "+7 999 abc 123 45 67" }, true).phone).toBeDefined();
    expect(validateRequest({ ...ok, phone: "12345" }, true).phone).toBeDefined();
    expect(validateRequest({ ...ok, phone: "8.999.123.45.67" }, true).phone).toBeUndefined();
  });

  it("checks email format", () => {
    expect(validateRequest({ ...ok, email: "ivan@" }, true).email).toBeDefined();
    expect(validateRequest({ ...ok, email: "почта@пример.рф" }, true).email).toBeUndefined();
  });
});

describe("контекст: регион с карты", () => {
  it("известный код субъекта подставляется названием, неизвестный игнорируется", () => {
    expect(describeRequestContext("/?region=RU-KGD&forma=okno")).toBe("Всплывающая форма; Регион на карте: Калининградская область");
    expect(describeRequestContext("/kontakty?region=RU-SEV")).toBe("Регион на карте: Севастополь");
    expect(describeRequestContext("/kontakty?region=<script>")).toBeNull();
    expect(describeRequestContext("/kontakty?region=constructor")).toBeNull();
  });
});

describe("describeRequestContext", () => {
  it("describes helper recommendation and service page", () => {
    expect(describeRequestContext("/kontakty?usluga=ocenka-kvartiry&rekomendaciya=otchet&obekt=realty")).toBe(
      "Помощник «Какой документ мне нужен?»: отчёт об оценке (квартира или другая недвижимость); Страница услуги: Оценка квартиры",
    );
  });

  it("marks the popup form and detects the service page from the path", () => {
    expect(describeRequestContext("/uslugi/ocenka-biznesa?forma=okno")).toBe("Всплывающая форма; Страница услуги: Оценка бизнеса");
    expect(describeRequestContext("/uslugi/sudebnaya-ekspertiza?forma=okno")).toBe("Всплывающая форма; Страница услуги: Судебная экспертиза");
    expect(describeRequestContext("/uslugi/unknown?forma=okno")).toBe("Всплывающая форма");
  });

  it("ignores unknown values and pages without context", () => {
    expect(describeRequestContext("/kontakty?rekomendaciya=<script>&usluga=hack")).toBeNull();
    expect(describeRequestContext("/kontakty")).toBeNull();
    expect(describeRequestContext(null)).toBeNull();
    expect(describeRequestContext("/kontakty?usluga=ocenka")).toBeNull();
  });
});
