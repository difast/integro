import { describe, expect, it } from "vitest";
import { csvCell, requestsToCsv } from "@/lib/requests/csv";

describe("csvCell", () => {
  it("wraps values in quotes and doubles inner quotes", () => {
    expect(csvCell('ООО "Ромашка"')).toBe('"ООО ""Ромашка"""');
  });

  it.each(["=SUM(A1:A2)", "+79990000000", "-1+1", "@cmd", "\tTAB", "\rCR", "＝1+1"])(
    "neutralises formula start: %s",
    (value) => {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    },
  );

  it("keeps ordinary text and line breaks", () => {
    expect(csvCell("Оценка\r\nквартиры")).toBe('"Оценка\nквартиры"');
  });
});

describe("requestsToCsv", () => {
  it("adds BOM, header, semicolon separators and readable status", () => {
    const csv = requestsToCsv([
      {
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: new Date("2026-10-18T07:30:00Z"),
        status: "in_progress",
        name: "=HYPERLINK(\"http://evil\")",
        phone: "+7 999 000-00-00",
        email: "a@b.ru",
        serviceTitle: "Оценочная деятельность",
        message: "Текст; с разделителем",
        notes: "",
        sourcePage: "/kontakty",
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header).toContain('"Дата поступления (МСК)";"Статус"');
    expect(row).toContain('"18.10.2026 10:30"');
    expect(row).toContain('"В работе"');
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain(`"'+7 999 000-00-00"`);
    expect(row).toContain('"Текст; с разделителем"');
  });
});
