"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Окно переписки с собственной прокруткой: при открытии показывает последние сообщения, при появлении
 * новых (автообновление) прокручивает вниз, только если оператор и так был внизу — чтение старых
 * сообщений не сбивается.
 */
export function ChatScroller({ lastId, startAtBottom, className, children }: { lastId: string; startAtBottom: boolean; className: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(startAtBottom);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if ((first.current && startAtBottom) || (!first.current && atBottom.current)) el.scrollTop = el.scrollHeight;
    first.current = false;
  }, [lastId, startAtBottom]);

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="История переписки"
      onScroll={(event) => {
        const el = event.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={className}
    >
      {children}
    </div>
  );
}
