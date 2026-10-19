/**
 * Переходы по кнопкам мессенджеров: допустимые значения и разбор входящих данных.
 * Модуль без зависимостей от сервера — используется и в браузере, и в API.
 */

export const messengerKeys = ["whatsapp", "telegram", "max"] as const;
export type MessengerKey = (typeof messengerKeys)[number];

export const messengerLabels: Record<MessengerKey, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  max: "MAX",
};

export const clickPlacements = ["header", "mobile_menu", "footer", "contacts"] as const;
export type ClickPlacement = (typeof clickPlacements)[number];

export const placementLabels: Record<ClickPlacement, string> = {
  header: "Шапка сайта",
  mobile_menu: "Мобильное меню",
  footer: "Подвал сайта",
  contacts: "Страница «Контакты»",
};

export type ClickEvent = { messenger: MessengerKey; placement: ClickPlacement; path: string };

const MAX_PATH = 200;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Путь страницы без адреса сайта, параметров и якоря. Чужие и подозрительные значения — null. */
export function normalizeClickPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.length > MAX_PATH || /[\s\u0000-\u001f<>"'`\\]/.test(path)) return null;
  return path;
}

/** Проверяет тело запроса от кнопки. Неверные данные — null (событие не сохраняется). */
export function parseClickEvent(body: unknown): ClickEvent | null {
  if (!body || typeof body !== "object") return null;
  const { messenger, placement, path } = body as Record<string, unknown>;
  if (!isOneOf(messengerKeys, messenger) || !isOneOf(clickPlacements, placement)) return null;
  const normalized = normalizeClickPath(path);
  return normalized ? { messenger, placement, path: normalized } : null;
}

// Поисковые и служебные роботы: их «переходы» в статистику не попадают.
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;

export function isBotUserAgent(userAgent: string | null): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

export const statsPeriods = [
  { value: "7", label: "7 дней", days: 7 },
  { value: "30", label: "30 дней", days: 30 },
  { value: "90", label: "90 дней", days: 90 },
  { value: "all", label: "Всё время", days: null },
] as const;
export type StatsPeriod = (typeof statsPeriods)[number];

export function parseStatsPeriod(value: unknown): StatsPeriod {
  return statsPeriods.find((period) => period.value === value) ?? statsPeriods[1];
}
