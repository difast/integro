/**
 * Ошибка API канала. Виды:
 * - http     — платформа ответила кодом ошибки (запрос обработан и отклонён; 429 — превышен лимит);
 * - connect  — соединение не установлено: запрос точно не дошёл, повтор безопасен;
 * - unknown  — соединение было, но ответ не получен: результат неизвестен, автоматический
 *              повтор может привести к дублю;
 * - config   — канал не настроен.
 */
export type ChannelErrorKind = "http" | "connect" | "unknown" | "config";

export class ChannelApiError extends Error {
  constructor(
    readonly kind: ChannelErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "ChannelApiError";
  }

  /** Повтор безопасен: запрос не дошёл или отклонён из-за лимита. */
  get retryable(): boolean {
    return this.kind === "connect" || this.status === 429 || this.status === 503;
  }

  /** Пользователь заблокировал бота или удалил чат: отправка невозможна до его нового обращения. */
  get blocked(): boolean {
    return false;
  }

  /** Короткое описание для журнала и админки (без секретов и персональных данных). */
  get summary(): string {
    if (this.kind === "http") return `API ${this.status}${this.code ? ` ${this.code}` : ""}: ${this.message}`.slice(0, 300);
    return this.message.slice(0, 300);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Повтор только безопасных ошибок (запрос не дошёл или лимит), не более двух раз. */
export async function withSafeRetry<T>(fn: () => Promise<T>, delays = [1_000, 3_000]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof ChannelApiError) || !error.retryable || attempt >= delays.length) throw error;
      await sleep(Math.min(error.retryAfterMs ?? delays[attempt]!, 30_000));
    }
  }
}
