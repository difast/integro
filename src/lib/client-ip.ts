import "server-only";
import { headers } from "next/headers";

/**
 * Адрес клиента за прокси хостинга. X-Real-IP выставляет прокси, поэтому он
 * в приоритете; X-Forwarded-For может содержать значения, переданные клиентом.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
