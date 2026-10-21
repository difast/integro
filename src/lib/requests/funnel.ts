/**
 * Воронка заявки и сделка. Этапы дополняют существующий рабочий статус заявки (new, in_progress, …):
 * статус — что делает сотрудник, этап — насколько заявка продвинулась к сделке.
 *
 * Полная воронка: 1. Первичное обращение (диалог в мессенджере или заявка с сайта) → 2. Квалифицированный
 * лид (отметка оператора в диалоге либо оформленная заявка) → 3. Заявка → 4. Переговоры → 5. Стоимость
 * согласована / счёт выставлен → 6. Сделка выиграна | 7. Сделка проиграна.
 */

export const requestStages = [
  { value: "request", label: "Заявка", order: 3 },
  { value: "negotiation", label: "Переговоры, согласование условий", order: 4 },
  { value: "priced", label: "Стоимость согласована / счёт выставлен", order: 5 },
  { value: "won", label: "Сделка выиграна", order: 6 },
  { value: "lost", label: "Сделка проиграна", order: 7 },
] as const;
export type RequestStage = (typeof requestStages)[number]["value"];

export function isRequestStage(value: unknown): value is RequestStage {
  return requestStages.some((s) => s.value === value);
}
export const stageLabel = (value: string) => requestStages.find((s) => s.value === value)?.label ?? value;

export const paymentStatuses = [
  { value: "none", label: "Оплаты нет" },
  { value: "partial", label: "Оплачено частично" },
  { value: "paid", label: "Оплачено полностью" },
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number]["value"];
export const isPaymentStatus = (value: unknown): value is PaymentStatus => paymentStatuses.some((s) => s.value === value);
export const paymentLabel = (value: string) => paymentStatuses.find((s) => s.value === value)?.label ?? value;

/** Каналы привлечения заявки. WhatsApp, Авито, телефон и почта — только ручная регистрация заявки. */
export const requestChannels = [
  { value: "site", label: "Сайт" },
  { value: "max", label: "MAX" },
  { value: "telegram", label: "Telegram" },
  { value: "web", label: "Веб-чат" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "avito", label: "Авито" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Электронная почта" },
  { value: "other", label: "Другое" },
] as const;
export type RequestChannel = (typeof requestChannels)[number]["value"];
export const isRequestChannel = (value: unknown): value is RequestChannel => requestChannels.some((c) => c.value === value);
export const channelLabel = (value: string) => requestChannels.find((c) => c.value === value)?.label ?? value;

/** Каналы, заявки из которых можно создать вручную (сайт и боты создают заявки сами, из веб-чата — из карточки диалога). */
export const manualChannels = requestChannels.filter((c) => !["site", "max", "telegram", "web"].includes(c.value));

export const CURRENCIES = ["RUB", "USD", "EUR", "CNY", "KZT", "BYN"] as const;
