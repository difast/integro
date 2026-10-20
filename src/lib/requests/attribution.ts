/**
 * Источник посещения сайта для аналитики заявок: UTM-метки, домен перехода и страница входа.
 *
 * Сбор: при первом заходе в вкладке метки из адреса и домен сайта-источника сохраняются в sessionStorage
 * (без cookie, удаляются при закрытии вкладки) и передаются только вместе с заявкой, которую посетитель
 * отправляет с согласием. Если меток нет — источник «не определён»; ничего не додумывается.
 */

export const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing"] as const;
export type Attribution = Partial<Record<(typeof attributionKeys)[number], string>>;

export const ATTRIBUTION_STORAGE_KEY = "integro-attribution";

const VALUE_RE = /^[\p{L}\p{N}_.\-+:/ %|]{1,100}$/u;

/** Проверка на сервере: только известные ключи, короткие значения без опасных символов. */
export function parseAttribution(raw: unknown): Attribution | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const result: Attribution = {};
  for (const key of attributionKeys) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 100);
    if (key === "landing" && !/^\/[\w\-./]*$/.test(trimmed)) continue;
    if (key === "referrer" && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) continue;
    if (VALUE_RE.test(trimmed)) result[key] = trimmed;
  }
  return Object.keys(result).length ? result : null;
}

/** Подпись источника для админки и аналитики. */
export function describeAttribution(value: Attribution | null | undefined): string {
  if (!value) return "Не определён";
  if (value.utm_source) return [value.utm_source, value.utm_medium, value.utm_campaign].filter(Boolean).join(" / ");
  if (value.referrer) return `Переход с ${value.referrer}`;
  return "Прямой заход";
}

/** Браузер: сохранить источник первого захода в этой вкладке. */
export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const value: Attribution = {};
    for (const key of attributionKeys) {
      const v = params.get(key);
      if (v && key.startsWith("utm_")) value[key] = v.slice(0, 100);
    }
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) value.referrer = host;
    }
    value.landing = window.location.pathname.slice(0, 100);
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage недоступен — источник будет «не определён».
  }
}

export function readAttribution(): string {
  try {
    return sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
