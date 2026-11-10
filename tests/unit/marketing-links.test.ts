import { describe, expect, it } from "vitest";
import { buildTargetUrl, parseMarketingLinkForm, shortLinkPath } from "@/lib/marketing/links";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("маркетинговые ссылки", () => {
  it("строит адрес страницы с UTM-метками, utm_content — короткое имя ссылки", () => {
    expect(
      buildTargetUrl({ slug: "threads-vera", targetPath: "/", utmSource: "threads", utmMedium: "social", utmCampaign: "threads" }),
    ).toBe("/?utm_source=threads&utm_medium=social&utm_campaign=threads&utm_content=threads-vera");
    expect(buildTargetUrl({ slug: "vk", targetPath: "/uslugi/ocenka", utmSource: "vk", utmMedium: "social", utmCampaign: "" })).toBe(
      "/uslugi/ocenka?utm_source=vk&utm_medium=social&utm_content=vk",
    );
    expect(shortLinkPath("threads")).toBe("/go/threads");
  });

  it("принимает корректную форму и приводит значения к нижнему регистру", () => {
    const result = parseMarketingLinkForm(
      form({ slug: "Instagram-Vera", title: "Instagram — Вера", ownerLabel: "Вера, HR", utmSource: "Instagram", targetPath: "" }),
    );
    expect(result).toEqual({
      link: {
        slug: "instagram-vera",
        title: "Instagram — Вера",
        ownerLabel: "Вера, HR",
        targetPath: "/",
        utmSource: "instagram",
        utmMedium: "social",
        utmCampaign: "",
      },
    });
  });

  it("отклоняет неверные значения", () => {
    const base = { slug: "ok-slug", title: "Название", utmSource: "threads", targetPath: "/" };
    expect(parseMarketingLinkForm(form({ ...base, slug: "-bad" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, slug: "с кириллицей" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, title: "" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, targetPath: "https://evil.example/" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, targetPath: "//evil.example" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, targetPath: "/a?b=1" }))).toHaveProperty("error");
    expect(parseMarketingLinkForm(form({ ...base, utmSource: "Threads App" }))).toHaveProperty("error");
  });
});
