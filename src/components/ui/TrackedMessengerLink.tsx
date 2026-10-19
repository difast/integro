"use client";

import type { ReactNode } from "react";
import type { ClickPlacement, MessengerKey } from "@/lib/stats/clicks";

/**
 * Ссылка на мессенджер с учётом перехода. sendBeacon отправляет событие и при уходе
 * со страницы; ссылка открывается как обычно и не ждёт ответа.
 */
export function TrackedMessengerLink({
  messenger,
  placement,
  href,
  className,
  label,
  children,
}: {
  messenger: MessengerKey;
  placement: ClickPlacement;
  href: string;
  className: string;
  label?: string;
  children: ReactNode;
}) {
  function track() {
    try {
      const body = JSON.stringify({ messenger, placement, path: window.location.pathname });
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/clicks", blob)) {
        void fetch("/api/clicks", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
      }
    } catch {
      // Учёт не должен мешать переходу.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label ? `Написать в ${label}` : undefined}
      title={label}
      onClick={track}
      onAuxClick={(event) => {
        if (event.button === 1) track();
      }}
    >
      {children}
    </a>
  );
}
