/** Короткий номер заявки для людей: первые 8 символов идентификатора (тот же, что сообщает бот). */
export function requestNumberOf(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
