/**
 * Маркетинговые ссылки: короткий адрес /go/<slug> → страница сайта с UTM-метками.
 * Модуль без зависимостей от сервера: используется в обработчике перехода, в админке и в тестах.
 */

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const UTM_RE = /^[a-z0-9_.-]{1,40}$/;
const PATH_RE = /^\/[A-Za-z0-9_./-]*$/;

export type MarketingLinkInput = {
  slug: string;
  title: string;
  ownerLabel: string;
  targetPath: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

/** Адрес страницы, на которую ведёт ссылка: путь сайта + UTM-метки (utm_content — короткое имя ссылки). */
export function buildTargetUrl(link: Pick<MarketingLinkInput, "slug" | "targetPath" | "utmSource" | "utmMedium" | "utmCampaign">): string {
  const params = new URLSearchParams({ utm_source: link.utmSource, utm_medium: link.utmMedium });
  if (link.utmCampaign) params.set("utm_campaign", link.utmCampaign);
  params.set("utm_content", link.slug);
  return `${link.targetPath}?${params.toString()}`;
}

/** Короткий адрес для публикации. */
export function shortLinkPath(slug: string): string {
  return `/go/${slug}`;
}

const text = (formData: FormData, key: string, max: number) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

/** Проверка формы новой ссылки. Возвращает данные или текст ошибки для администратора. */
export function parseMarketingLinkForm(formData: FormData): { link: MarketingLinkInput } | { error: string } {
  const link: MarketingLinkInput = {
    slug: text(formData, "slug", 60).toLowerCase(),
    title: text(formData, "title", 120),
    ownerLabel: text(formData, "ownerLabel", 120),
    targetPath: text(formData, "targetPath", 220) || "/",
    utmSource: text(formData, "utmSource", 60).toLowerCase(),
    utmMedium: text(formData, "utmMedium", 60).toLowerCase() || "social",
    utmCampaign: text(formData, "utmCampaign", 60).toLowerCase(),
  };
  if (!SLUG_RE.test(link.slug)) return { error: "Короткое имя: 2–40 символов, латинские буквы, цифры и дефис, начинается с буквы или цифры." };
  if (!link.title || link.title.length > 100) return { error: "Укажите название ссылки (до 100 символов)." };
  if (link.ownerLabel.length > 100) return { error: "Чья ссылка — не более 100 символов." };
  if (!PATH_RE.test(link.targetPath) || link.targetPath.length > 200 || link.targetPath.startsWith("//")) {
    return { error: "Страница сайта — путь вида /uslugi/ocenka (без адреса сайта и параметров)." };
  }
  if (!UTM_RE.test(link.utmSource)) return { error: "Источник (площадка): латинские буквы, цифры, точка, дефис или подчёркивание — например threads." };
  if (!UTM_RE.test(link.utmMedium)) return { error: "Тип трафика: латинские буквы и цифры — например social." };
  if (link.utmCampaign && !UTM_RE.test(link.utmCampaign)) return { error: "Кампания: латинские буквы, цифры, точка, дефис или подчёркивание." };
  return { link };
}
