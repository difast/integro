import { describe, expect, it } from "vitest";
import {
  caseOptions,
  objectOptions,
  purposeOptions,
  recommend,
  requestHref,
  userOptions,
  type Answers,
  type ObjectType,
} from "@/lib/document-helper";
import { servicePages } from "@/config/service-pages";
import { services } from "@/config/services";

const knownRoutes = new Set([...services.map((s) => `/uslugi/${s.slug}`), ...servicePages.map((p) => `/uslugi/${p.slug}`)]);

/** Все допустимые сочетания ответов (последний вопрос зависит от первого). */
function allAnswers(): Required<Answers>[] {
  const list: Required<Answers>[] = [];
  for (const purpose of purposeOptions)
    for (const caseStatus of caseOptions)
      for (const user of userOptions)
        for (const object of objectOptions(purpose.value))
          list.push({ purpose: purpose.value, caseStatus: caseStatus.value, user: user.value, object: object.value });
  return list;
}

describe("recommend — все ветки", () => {
  const combos = allAnswers();

  it("covers every combination", () => {
    expect(combos.length).toBeGreaterThan(400);
  });

  it.each(combos.map((a) => [`${a.purpose}/${a.caseStatus}/${a.user}/${a.object}`, a] as const))("%s", (_name, answers) => {
    const result = recommend(answers);
    expect(["report", "specialist", "court", "consult"]).toContain(result.kind);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.prepare.length).toBeGreaterThan(0);

    // Ссылка на услугу ведёт на существующую страницу; у консультации ссылки нет.
    if (result.kind === "consult") expect(result.service).toBeNull();
    else expect(knownRoutes.has(result.service!.href)).toBe(true);

    // Судебная экспертиза — только при возбуждённом деле.
    if (result.kind === "court") expect(answers.caseStatus).toBe("in-court");

    // Неопределённая задача всегда ведёт к консультации.
    if (answers.purpose === "unsure") expect(result.kind).toBe("consult");

    // Ссылка на заявку: только известные параметры, без персональных данных.
    const href = requestHref(result, answers);
    expect(href.startsWith("/kontakty?")).toBe(true);
    const params = new URLSearchParams(href.slice("/kontakty?".length).split("#")[0]);
    expect([...params.keys()].every((k) => ["usluga", "rekomendaciya", "obekt"].includes(k))).toBe(true);
  });
});

describe("recommend — ключевые сценарии", () => {
  const base = { caseStatus: "none", user: "self" } as const;

  it("стоимость квартиры без суда → отчёт об оценке квартиры", () => {
    const r = recommend({ ...base, purpose: "value", object: "realty" });
    expect(r.kind).toBe("report");
    expect(r.service?.href).toBe("/uslugi/ocenka-kvartiry");
    expect(r.notes.join(" ")).toMatch(/не единственный/);
  });

  it("ущерб от залива → отчёт, с оговоркой о причине", () => {
    const r = recommend({ ...base, purpose: "damage", object: "flood" });
    expect(r.kind).toBe("report");
    expect(r.service?.href).toBe("/uslugi/ocenka-ushcherba-ot-zaliva");
    expect(r.notes.join(" ")).toMatch(/причин/);
  });

  it("качество ремонта без суда → заключение специалиста (строительно-техническое)", () => {
    const r = recommend({ ...base, purpose: "technical", object: "construction" });
    expect(r.kind).toBe("specialist");
    expect(r.service?.href).toBe("/uslugi/stroitelno-tehnicheskaya-ekspertiza");
  });

  it("дело в суде → судебная экспертиза с оговоркой, что решает суд", () => {
    const r = recommend({ purpose: "court", caseStatus: "in-court", user: "lawyer", object: "construction" });
    expect(r.kind).toBe("court");
    expect(r.notes.join(" ")).toMatch(/принимает суд/);
    expect(r.lawyers).toBe(true);
  });

  it("спор, но дела нет → не судебная экспертиза", () => {
    const r = recommend({ purpose: "court", caseStatus: "planning", user: "lawyer", object: "realty" });
    expect(r.kind).toBe("specialist");
    expect(r.notes.join(" ")).toMatch(/суд может назначить/);
  });

  it("«документ нужен суду», но дела нет → противоречие, консультация", () => {
    const r = recommend({ purpose: "value", caseStatus: "none", user: "court", object: "realty" });
    expect(r.kind).toBe("consult");
    expect(r.reasons[0]).toMatch(/судебного дела пока нет/);
  });

  it("технические вопросы о бизнесе → консультация", () => {
    expect(recommend({ ...base, purpose: "technical", object: "business" }).kind).toBe("consult");
  });

  it("ущерб автомобилю → отчёт с оговоркой об ОСАГО", () => {
    const r = recommend({ ...base, purpose: "damage", object: "car" });
    expect(r.kind).toBe("report");
    expect(r.notes.join(" ")).toMatch(/ОСАГО/);
  });
});

describe("objectOptions", () => {
  it("adapts the last question to the purpose", () => {
    const values = (p: Parameters<typeof objectOptions>[0]) => objectOptions(p).map((o) => o.value as ObjectType);
    expect(values("value")).not.toContain("flood");
    expect(values("damage")).toContain("flood");
    expect(values("technical")).toContain("construction");
    expect(values("unsure")).toHaveLength(6);
  });
});
