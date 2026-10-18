import { describe, expect, it } from "vitest";
import { formServiceFor, servicePages } from "@/config/service-pages";
import { services } from "@/config/services";

const allSlugs = new Set([...services.map((s) => s.slug), ...servicePages.map((p) => p.slug)]);

describe("service pages", () => {
  it("has the five required pages with unique slugs and metadata", () => {
    expect(servicePages.map((p) => p.slug)).toEqual([
      "ocenka-kvartiry",
      "ocenka-biznesa",
      "ocenka-ushcherba-ot-zaliva",
      "ocenka-avtomobilya",
      "stroitelno-tehnicheskaya-ekspertiza",
    ]);
    for (const key of ["slug", "title", "metaTitle", "metaDescription"] as const) {
      const values = [...servicePages.map((p) => p[key]), ...services.map((s) => (key === "metaTitle" ? s.title : (s as never)[key]))].filter(Boolean);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it.each(servicePages.map((p) => [p.slug, p] as const))("%s: SEO and links", (_slug, page) => {
    expect(page.metaDescription.length).toBeGreaterThanOrEqual(110);
    expect(page.metaDescription.length).toBeLessThanOrEqual(200);
    expect(page.metaTitle.length).toBeLessThanOrEqual(60);
    expect(page.slug).toMatch(/^[a-z0-9-]+$/);
    for (const slug of page.related) expect(allSlugs.has(slug)).toBe(true);
    for (const item of page.differences.items) if (item.href) expect(allSlugs.has(item.href.replace("/uslugi/", ""))).toBe(true);
    expect(formServiceFor(page.slug)).toBe(page.formService);
  });

  it("does not promise results, prices or terms", () => {
    const text = JSON.stringify(servicePages).toLowerCase();
    for (const word of ["гарантируем", "гарантия результата", "₽", "руб.", "рабочих дней", "лучший", "лучшие", "№1", "отзыв"]) {
      expect(text).not.toContain(word);
    }
  });

  it("maps form service for base and unknown slugs", () => {
    expect(formServiceFor("ocenka")).toBe("ocenka");
    expect(formServiceFor("unknown")).toBe("");
    expect(formServiceFor(undefined)).toBe("");
  });
});
