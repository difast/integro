"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markReadQuiet } from "@/app/admin/uvedomleniya/actions";

type Item = { id: string; title: string; body: string; link: string | null; createdAt: string; read: boolean; channel: string };

const INTERVAL_MS = 20_000;
const time = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Индикатор уведомлений в шапке админки. Опрашивает сервер раз в 20 секунд, пока вкладка открыта,
 * и сразу при возвращении на вкладку; число непрочитанных дублируется в заголовке вкладки.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const baseTitle = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { unread: number; latest: Item[] };
      setUnread(data.unread);
      setItems(data.latest);
    } catch {
      // Нет сети — повторим при следующем опросе.
    }
  }, []);

  useEffect(() => {
    // Первая загрузка — сразу после монтирования (асинхронно, вне тела эффекта).
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    baseTitle.current ??= document.title.replace(/^\(\d+\) /, "");
    document.title = unread > 0 ? `(${unread}) ${baseTitle.current}` : baseTitle.current;
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function openItem(item: Item) {
    if (!item.read) await markReadQuiet(item.id);
    setOpen(false);
    void load();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void load();
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Уведомления: непрочитанных ${unread}` : "Уведомления"}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-line-strong text-ink transition-colors hover:border-dark"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unread > 0 ? (
          <span data-testid="unread-count" className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-danger px-1.5 text-center text-[0.6875rem] leading-5 font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-[0.875rem] font-medium text-ink">Уведомления</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await markReadQuiet("all");
                  void load();
                }}
                className="text-[0.8125rem] text-link"
              >
                Прочитать все
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[0.875rem] text-muted">Уведомлений пока нет.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.link ?? "/admin/uvedomleniya"} onClick={() => void openItem(item)} className={`block px-4 py-3 hover:bg-mist/60 ${item.read ? "" : "bg-bronze-soft/60"}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-[0.875rem] font-medium break-words text-ink">{item.title}</span>
                      <span className="shrink-0 text-[0.75rem] text-muted">{time.format(new Date(item.createdAt))}</span>
                    </span>
                    {item.body ? <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{item.body}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/uvedomleniya" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-[0.875rem] font-medium text-link">
            Все уведомления
          </Link>
        </div>
      ) : null}
    </div>
  );
}
