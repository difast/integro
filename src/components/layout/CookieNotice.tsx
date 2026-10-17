"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { legalDocuments } from "@/config/legal";

/**
 * Уведомление о файлах cookie.
 *
 * Код сайта не устанавливает cookie и не подключает аналитику и рекламу
 * (см. политику, п. 3.2). Уведомление информирует о возможных технических
 * cookie инфраструктуры. Выбор хранится в localStorage этого браузера —
 * сам по себе он не является cookie и на сервер не передаётся.
 * При подключении аналитики или рекламы текст и механику нужно пересмотреть
 * (см. LEGAL_REVIEW.md).
 */
const STORAGE_KEY = "integro-cookie-notice";
const STORAGE_VALUE = "accepted-v1";
const listeners = new Set<() => void>();
// Запасной флаг на случай недоступного localStorage: скрыть до перезагрузки.
let hiddenThisSession = false;

function readAccepted(): boolean {
  if (hiddenThisSession) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === STORAGE_VALUE;
  } catch {
    // Хранилище недоступно (приватный режим и т. п.) — показываем уведомление.
    return false;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function CookieNotice() {
  // На сервере уведомление не рендерится, чтобы не мелькало у тех, кто его уже принял.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);

  if (accepted) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
    } catch {
      // Если сохранить нельзя, уведомление просто скроется до перезагрузки.
    }
    hiddenThisSession = true;
    listeners.forEach((listener) => listener());
  };

  return (
    <div
      role="region"
      aria-label="Уведомление о файлах cookie"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-[380px]"
    >
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[0_20px_50px_-24px_rgba(38,55,70,0.45)] sm:p-5">
        <p className="text-[0.8125rem] leading-relaxed text-body">
          Сайт не использует аналитические и рекламные файлы cookie. Для работы сайта могут применяться только
          технические cookie. Подробнее — в{" "}
          <Link href={`${legalDocuments.policy.href}#celi`} className="text-link">
            политике обработки персональных данных
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="inline-flex min-h-10 items-center justify-center self-start rounded-[var(--radius-control)] bg-dark px-5 text-[0.875rem] font-medium text-white transition-colors hover:bg-dark-800"
        >
          Принять
        </button>
      </div>
    </div>
  );
}
