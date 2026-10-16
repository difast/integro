import { company, type Requisites } from "@/config/company";

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

const requisiteLabels: Record<keyof Requisites, string> = {
  inn: "ИНН",
  kpp: "КПП",
  ogrn: "ОГРН",
  legalAddress: "Юридический адрес",
  director: "Генеральный директор",
  bankAccount: "Расчётный счёт",
  bankName: "Банк",
  bik: "БИК",
  correspondentAccount: "Корр. счёт",
};

/** Только заполненные реквизиты, в фиксированном порядке. */
export function filledRequisites(): { label: string; value: string }[] {
  return (Object.keys(requisiteLabels) as (keyof Requisites)[])
    .map((key) => ({ label: requisiteLabels[key], value: company.requisites[key] }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value));
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
