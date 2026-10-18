/** Статусы заявок (общие для сервера и клиента). */
export const requestStatuses = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_client", label: "Ожидает ответа клиента" },
  { value: "done", label: "Завершена" },
  { value: "rejected", label: "Отклонена" },
] as const;

export type RequestStatus = (typeof requestStatuses)[number]["value"];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && requestStatuses.some((status) => status.value === value);
}

export function statusLabel(value: string): string {
  return requestStatuses.find((status) => status.value === value)?.label ?? value;
}

export const NOTES_MAX_LENGTH = 5000;
