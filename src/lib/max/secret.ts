import { timingSafeEqual } from "node:crypto";

/** Сравнение секрета Webhook за постоянное время. */
export function isWebhookSecretValid(received: string | null, expected: string | null): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
