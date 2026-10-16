import { company } from "@/config/company";

/** Основной адрес сайта: переменная SITE_URL имеет приоритет над конфигом. */
export function getSiteUrl(): string | null {
  const raw = process.env.SITE_URL?.trim() || company.siteUrl;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Базовый URL для metadataBase. Если домен ещё не задан, используется
 * локальный адрес — canonical и sitemap в этом случае не публикуются.
 */
export function getMetadataBase(): URL {
  return new URL(getSiteUrl() ?? "http://localhost:3000");
}

export function absoluteUrl(path: string): string | null {
  const base = getSiteUrl();
  return base ? `${base}${path === "/" ? "" : path}` : null;
}

/** "+7 (495) 000-00-00" -> "tel:+74950000000" */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function hasAnyContact(): boolean {
  const { phone, email, officeAddress } = company.contacts;
  return Boolean(phone || email || officeAddress);
}

export function copyrightYears(): string {
  const now = new Date().getFullYear();
  const since = company.copyrightSince;
  return since && since < now ? `${since}–${now}` : String(now);
}

/**
 * Черновое содержимое (формулировки, требующие подтверждения владельцем)
 * показывается в режиме разработки и скрыто в production, пока не включено
 * переменной SHOW_DRAFT_CONTENT=true.
 */
export const showDraftContent =
  process.env.NODE_ENV !== "production" || process.env.SHOW_DRAFT_CONTENT === "true";

/** Часы связи для середины фразы: «Часы связи: ежедневно с 10:00…». */
export function workingHoursInline(): string | null {
  const hours = company.contacts.workingHours;
  return hours ? hours.charAt(0).toLowerCase() + hours.slice(1) : null;
}
