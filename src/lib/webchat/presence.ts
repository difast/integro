/** Посетитель веб-чата «в чате»: открытый виджет опрашивает сервер каждые несколько секунд. */
export const ONLINE_WINDOW_MS = 60_000;

export function isVisitorOnline(activeAt: Date | null, now = Date.now()): boolean {
  return activeAt !== null && now - activeAt.getTime() < ONLINE_WINDOW_MS;
}
