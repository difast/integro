/**
 * Защита API админки от межсайтовых запросов (CSRF): запрос, изменяющий данные, принимается только
 * с того же сайта (заголовок Origin совпадает с Host). Серверные действия Next.js проверяют это сами.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
