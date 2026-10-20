/** Разбор сумм и дат из форм админки (проверка на сервере). */

/** Сумма: «12 345,50» → "12345.50"; пусто → null; ошибка → "bad". */
export function parseMoney(raw: FormDataEntryValue | null): string | null | "bad" {
  const value = typeof raw === "string" ? raw.replace(/[\s\u00a0]/g, "").replace(",", ".") : "";
  if (!value) return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) return "bad";
  return Number(value).toFixed(2);
}

/** Дата YYYY-MM-DD в разумных пределах; пусто → null; ошибка → "bad". */
export function parseDate(raw: FormDataEntryValue | null): string | null | "bad" {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "bad";
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return "bad";
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? value : "bad";
}
