"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Обновляет данные страницы (новые сообщения из Webhook) каждые intervalMs, пока вкладка открыта.
 * Введённый текст в формах при обновлении сохраняется.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
