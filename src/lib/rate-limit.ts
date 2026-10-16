import "server-only";

/**
 * Ограничение частоты отправки формы в памяти процесса.
 * IP-адреса не записываются на диск и удаляются не позднее чем через
 * 15 минут — так описано в политике обработки персональных данных.
 * Подходит для одного экземпляра приложения.
 */
// Окно 14 минут + очистка раз в минуту: запись живёт не более 15 минут.
const WINDOW_MS = 14 * 60_000;
const hits = new Map<string, number[]>();

function purgeExpired(now: number) {
  for (const [key, times] of hits) {
    const recent = times.filter((time) => now - time < WINDOW_MS);
    if (recent.length === 0) hits.delete(key);
    else if (recent.length !== times.length) hits.set(key, recent);
  }
}

// Фоновая очистка, чтобы записи не жили дольше окна, даже если запросов больше нет.
const timer = setInterval(() => purgeExpired(Date.now()), 60_000);
timer.unref?.();

export function isRateLimited(key: string, limit = 5): boolean {
  const now = Date.now();
  purgeExpired(now);
  const recent = hits.get(key) ?? [];
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(key, recent);
  return false;
}
