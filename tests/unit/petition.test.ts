import { describe, expect, it } from "vitest";
import { buildPetition, buildPetitionDocument, codesMentioned, emptyFields, petitionToHtmlPage, proceedingKinds, proceedings } from "@/lib/petition";

const ownCodes = {
  civil: ["ГПК РФ", "Гражданского процессуального"],
  arbitration: ["АПК РФ", "Арбитражного процессуального"],
  administrative: ["КАС РФ", "административного судопроизводства"],
} as const;

describe("buildPetitionDocument", () => {
  it("lays out the document: addressee on the right, centered title, justified body, signature row", () => {
    const blocks = buildPetitionDocument("civil", { ...emptyFields, court: "Тверской районный суд", date: "18.10.2026", signatory: "Иванов И. И." });
    expect(blocks[0]).toMatchObject({ type: "addressee" });
    expect((blocks[0] as { lines: string[] }).lines[0]).toBe("В Тверской районный суд");
    expect(blocks[1]).toEqual({ type: "title", lines: ["ХОДАТАЙСТВО", "о назначении судебной экспертизы"] });
    expect(blocks.find((b) => b.type === "heading" && b.text === "ПРОШУ:")).toMatchObject({ align: "center" });
    expect(blocks.at(-1)).toEqual({ type: "signature", left: "18.10.2026", right: "Иванов И. И." });
  });

  it("escapes user input in the HTML preview", () => {
    const html = petitionToHtmlPage(buildPetitionDocument("civil", { ...emptyFields, court: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('class="addressee"');
    expect(html).toContain("text-align: center");
  });
});

describe("buildPetition", () => {
  it.each(proceedingKinds)("%s: только нормы своего кодекса", (kind) => {
    const text = buildPetition(kind, emptyFields);
    const mentioned = codesMentioned(text);
    expect(mentioned.length).toBeGreaterThan(0);
    expect(mentioned.every((code) => (ownCodes[kind] as readonly string[]).includes(code))).toBe(true);
  });

  it.each(proceedingKinds)("%s: ссылки и пояснения не смешивают кодексы", (kind) => {
    const p = proceedings[kind];
    const foreign = proceedingKinds.filter((k) => k !== kind).map((k) => proceedings[k].code);
    for (const law of p.laws) expect(foreign.some((code) => law.title.includes(code))).toBe(false);
    for (const paragraph of p.explanation) expect(foreign.some((code) => paragraph.includes(code))).toBe(false);
  });

  it("shows placeholders for empty fields and required sections", () => {
    const text = buildPetition("civil", emptyFields);
    for (const part of ["ХОДАТАЙСТВО", "ПРОШУ:", "Приложения:", "[наименование суда общей юрисдикции]", "[вопрос эксперту]", "[дата]"]) {
      expect(text).toContain(part);
    }
  });

  it("fills values and numbers questions and attachments", () => {
    const text = buildPetition("arbitration", {
      ...emptyFields,
      court: "Арбитражный суд города Москвы",
      caseNumber: "А40-1/2026",
      applicantStatus: "истец",
      questions: "Какова стоимость доли?\n\n2) Какие факторы существенны?",
      attachments: "Письмо экспертной организации",
      expertiseType: "оценочную",
    });
    expect(text).toContain("В Арбитражный суд города Москвы");
    expect(text).toContain("Дело № А40-1/2026");
    expect(text).toContain("   1. Какова стоимость доли?\n   2. Какие факторы существенны?");
    expect(text).toContain("Назначить по делу оценочную экспертизу");
    expect(text).toContain("статья 108 АПК РФ");
    expect(text).not.toContain("[вопрос эксперту]");
  });

  it("uses procedural statuses of the selected code", () => {
    expect(proceedings.administrative.statuses).toContain("административный истец");
    expect(proceedings.civil.statuses).not.toContain("административный истец");
    expect(buildPetition("administrative", emptyFields)).toContain("Административное дело №");
  });
});
