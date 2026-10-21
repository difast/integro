"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, ArrowDown, Check, Clock, Loader2, MessageCircle, RotateCw, Send, X } from "lucide-react";
import { useCookieNoticeAccepted } from "@/components/layout/CookieNotice";

/**
 * Онлайн-чат на сайте. Отображаемое имя консультанта — «Анастасия» (единое для всех сотрудников;
 * фактический автор ответа хранится в данных CRM). Ответы пишут только сотрудники из админки;
 * автоматическое здесь только приветствие, и оно не сохраняется в базе.
 *
 * Связь с сервером — опрос (polling): каждые 3 с при открытом чате, каждые 25 с при закрытом (для счётчика
 * непрочитанных), пауза в скрытой вкладке, при ошибках — растущий интервал. После восстановления связи
 * пропущенные сообщения приходят по курсору (after/since); дубли отбрасываются по id.
 */

type ServerMessage = { id: string; from: "visitor" | "consultant"; text: string; createdAt: string };
type LocalMessage = ServerMessage & { localKey?: string; state?: "sending" | "failed" };
type Updates = {
  dialog: boolean;
  messages?: ServerMessage[];
  hasMore?: boolean;
  serverTime?: string;
  typing?: boolean;
  status?: "open" | "closed";
  unread?: number;
};

const OPEN_INTERVAL = 3_000;
const CLOSED_INTERVAL = 25_000;
const MAX_BACKOFF = 30_000;
const MAX_LENGTH = 2000;
const DRAFT_KEY = "integro-webchat-draft";
const GREETING =
  "Здравствуйте! Меня зовут Анастасия, я онлайн-консультант компании «Интегро». Помогу сориентироваться по услугам оценки и экспертизы. Расскажите, пожалуйста, какой у вас вопрос.";

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? timeFormat.format(date) : dateTimeFormat.format(date);
}

function merge(list: LocalMessage[], incoming: ServerMessage[]): LocalMessage[] {
  if (!incoming.length) return list;
  const byId = new Map(list.filter((m) => !m.localKey || m.state !== "sending").map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m, state: undefined });
  // Отправляемые и неотправленные сообщения посетителя — в конце, пока сервер их не подтвердил.
  const pending = list.filter((m) => m.state && !incoming.some((i) => i.id === m.id));
  const confirmed = [...byId.values()].filter((m) => !m.state).sort((a, b) => Number(a.id) - Number(b.id));
  return [...confirmed, ...pending];
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
}

export function WebChatWidget({ workingHours, policyHref }: { workingHours: string | null; policyHref: string }) {
  const pathname = usePathname();
  const cookieAccepted = useCookieNoticeAccepted();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDialog, setHasDialog] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<"open" | "closed">("open");
  const [unread, setUnread] = useState(0);
  const [offline, setOffline] = useState(false);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newBelow, setNewBelow] = useState(false);

  const cursor = useRef<{ after: string | null; since: string | null }>({ after: null, since: null });
  const loaded = useRef(false);
  const failures = useRef(0);
  const timer = useRef<number | null>(null);
  const openRef = useRef(open);
  const sending = useRef(false);
  const queue = useRef<LocalMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const hasDialogRef = useRef(hasDialog);
  useEffect(() => {
    openRef.current = open;
    hasDialogRef.current = hasDialog;
  }, [open, hasDialog]);

  // Появление кнопки — после загрузки страницы, без резкого «выпрыгивания».
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 600);
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      // Восстановление черновика возможно только после монтирования.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (draft) setText(draft.slice(0, MAX_LENGTH));
    } catch {
      // хранилище недоступно
    }
    return () => window.clearTimeout(t);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(false);
  }, []);

  const apply = useCallback(
    (data: Updates, mode: "replace" | "append" | "prepend") => {
      setHasDialog(data.dialog);
      if (!data.dialog) return;
      const incoming = data.messages ?? [];
      if (mode === "prepend") {
        setMessages((list) => [...incoming.filter((m) => !list.some((x) => x.id === m.id)), ...list]);
        setHasMore(Boolean(data.hasMore));
        return;
      }
      if (mode === "replace") setHasMore(Boolean(data.hasMore));
      setMessages((list) => merge(mode === "replace" ? list.filter((m) => m.state) : list, incoming));
      const last = incoming.at(-1);
      if (last && (!cursor.current.after || Number(last.id) > Number(cursor.current.after))) cursor.current.after = last.id;
      if (data.serverTime) cursor.current.since = data.serverTime;
      setTyping(Boolean(data.typing));
      setDialogStatus(data.status ?? "open");
      setUnread(openRef.current ? 0 : (data.unread ?? 0));
      if (incoming.length && openRef.current) {
        if (atBottom.current) requestAnimationFrame(() => scrollToBottom(true));
        else if (incoming.some((m) => m.from === "consultant")) setNewBelow(true);
      }
    },
    [scrollToBottom],
  );

  const poll = useCallback(async () => {
    const c = cursor.current;
    const url = loaded.current && c.after ? `/api/webchat?after=${c.after}${c.since ? `&since=${encodeURIComponent(c.since)}` : ""}` : "/api/webchat";
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as Updates;
      apply(data, loaded.current ? "append" : "replace");
      loaded.current = true;
      failures.current = 0;
      setOffline(false);
      if (openRef.current && data.dialog && (data.unread ?? 0) > 0) void postJson("/api/webchat/read", {}).catch(() => undefined);
    } catch {
      failures.current += 1;
      if (failures.current >= 2) setOffline(true);
    }
  }, [apply]);

  // Цикл опроса: частота зависит от состояния окна; в скрытой вкладке — пауза.
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const base = openRef.current ? OPEN_INTERVAL : CLOSED_INTERVAL;
      const delay = failures.current ? Math.min(MAX_BACKOFF, base * 2 ** Math.min(failures.current, 4)) : base;
      timer.current = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (document.visibilityState === "visible" && (openRef.current || hasDialogRef.current !== false)) await poll();
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer.current) window.clearTimeout(timer.current);
      void run();
    };
    // Первый запрос — узнать, есть ли уже переписка в этом браузере (диалог при этом не создаётся).
    const first = window.setTimeout(run, 1200);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [poll]);

  // Открытие: свежие данные, отметка о прочтении, прокрутка вниз, фокус в поле ввода (на компьютере).
  useEffect(() => {
    if (!open) return;
    void poll().finally(() => {
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom());
    });
    if (hasDialogRef.current) void postJson("/api/webchat/read", {}).catch(() => undefined);
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [open, poll, scrollToBottom]);

  // Мобильная клавиатура: окно занимает видимую область экрана, поле ввода не уходит под клавиатуру.
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const panel = panelRef.current;
    if (!open || !vv || !panel) return;
    const fit = () => {
      if (window.matchMedia("(min-width: 640px)").matches) {
        panel.style.removeProperty("height");
        panel.style.removeProperty("top");
        return;
      }
      panel.style.height = `${vv.height}px`;
      panel.style.top = `${vv.offsetTop}px`;
      if (atBottom.current) scrollToBottom();
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, [open, scrollToBottom]);

  // Esc закрывает окно.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const saveDraft = (value: string) => {
    try {
      if (value) sessionStorage.setItem(DRAFT_KEY, value);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // хранилище недоступно
    }
  };

  // Сообщения уходят строго по очереди: первое создаёт диалог и cookie, следующие идут уже в него.
  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      while (queue.current.length) {
        const item = queue.current[0]!;
        let response: Response;
        try {
          response = await postJson("/api/webchat/messages", { text: item.text, key: item.localKey, consent: true, source: window.location.pathname });
        } catch {
          markFailed(item, "Нет связи с сервером. Сообщение не отправлено.");
          continue;
        }
        if (response.ok) {
          const data = (await response.json()) as { message: ServerMessage };
          queue.current.shift();
          setHasDialog(true);
          setMessages((list) => {
            const rest = list.filter((m) => m.localKey !== item.localKey);
            return merge(rest, [data.message]);
          });
          if (!cursor.current.after || Number(data.message.id) > Number(cursor.current.after)) cursor.current.after = data.message.id;
          setDialogStatus("open");
          requestAnimationFrame(() => scrollToBottom(true));
          continue;
        }
        const error = await response.json().catch(() => ({}) as { error?: string });
        const reason =
          response.status === 429
            ? "Слишком много сообщений подряд. Подождите немного и повторите."
            : error.error === "too_long"
              ? `Сообщение длиннее ${MAX_LENGTH} символов.`
              : error.error === "consent"
                ? "Нужно согласие на обработку персональных данных."
                : "Сервер временно недоступен. Сообщение не отправлено.";
        markFailed(item, reason);
      }
    } finally {
      sending.current = false;
    }
    function markFailed(item: LocalMessage, reason: string) {
      queue.current = queue.current.filter((q) => q.localKey !== item.localKey);
      setMessages((list) => list.map((m) => (m.localKey === item.localKey ? { ...m, state: "failed" } : m)));
      setNotice(reason);
    }
  }, [scrollToBottom]);

  const send = () => {
    const value = text.replace(/\r\n?/g, "\n").trim();
    if (!value) return;
    if (value.length > MAX_LENGTH) {
      setNotice(`Сообщение длиннее ${MAX_LENGTH} символов — сократите его или разделите на части.`);
      return;
    }
    if (!hasDialog && !consent) {
      setNotice("Отметьте согласие на обработку персональных данных, чтобы отправить сообщение.");
      return;
    }
    const key = crypto.randomUUID();
    const item: LocalMessage = { id: `local-${key}`, localKey: key, from: "visitor", text: value, createdAt: new Date().toISOString(), state: "sending" };
    setMessages((list) => [...list, item]);
    setText("");
    saveDraft("");
    setNotice(null);
    queue.current.push(item);
    requestAnimationFrame(() => scrollToBottom(true));
    void flush();
  };

  // Повтор — с тем же ключом: если первая попытка всё-таки сохранилась, дубля не будет.
  const retry = (item: LocalMessage) => {
    setMessages((list) => list.map((m) => (m.localKey === item.localKey ? { ...m, state: "sending" } : m)));
    setNotice(null);
    queue.current.push({ ...item, state: "sending" });
    void flush();
  };
  const discard = (item: LocalMessage) => {
    setMessages((list) => list.filter((m) => m.localKey !== item.localKey));
    setText((current) => current || item.text);
  };

  const loadEarlier = async () => {
    const first = messages.find((m) => !m.state);
    if (!first) return;
    const el = listRef.current;
    const height = el?.scrollHeight ?? 0;
    try {
      const response = await fetch(`/api/webchat?before=${first.id}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      apply((await response.json()) as Updates, "prepend");
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - height;
      });
    } catch {
      setNotice("Не удалось загрузить ранние сообщения. Повторите позже.");
    }
  };

  if (pathname?.startsWith("/admin")) return null;
  // Пока в том же углу показано уведомление о cookie, кнопка чата не выводится, чтобы не перекрывать его.
  const launcherVisible = ready && cookieAccepted;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnread(0);
            setLoading(!loaded.current);
          }}
          aria-label={unread ? `Онлайн-консультант, новых сообщений: ${unread}` : "Открыть онлайн-чат с консультантом"}
          className={`fixed right-4 bottom-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-dark pr-5 pl-4 text-[0.9375rem] font-medium text-white shadow-[0_12px_32px_-12px_rgba(38,55,70,0.6)] transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-dark-800 sm:right-5 sm:bottom-5 ${
            launcherVisible ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0"
          }`}
          data-testid="webchat-launcher"
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">Онлайн-консультант</span>
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bronze px-1 text-[0.75rem] font-semibold text-dark" data-testid="webchat-unread">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="webchat-title"
          className="webchat-panel fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-white sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(600px,calc(100dvh-2.5rem))] sm:w-[380px] sm:rounded-[var(--radius-card)] sm:border sm:border-line sm:shadow-[0_24px_60px_-24px_rgba(38,55,70,0.5)]"
          data-testid="webchat-panel"
        >
          <header className="flex shrink-0 items-center gap-3 bg-dark px-4 py-3 text-white">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bronze-soft text-[1rem] font-semibold text-dark">
              А
            </span>
            <span className="min-w-0 flex-1">
              <span id="webchat-title" className="block text-[1rem] leading-tight font-medium">
                Анастасия
              </span>
              <span className="block truncate text-[0.75rem] text-on-dark">Онлайн-консультант компании «Интегро»</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Свернуть чат"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>

          <p aria-live="polite" className="shrink-0 border-b border-line bg-mist/60 px-4 py-1.5 text-[0.75rem] text-muted" data-testid="webchat-status">
            {offline ? (
              <span className="text-danger">Нет связи с сервером. Повторяем попытку…</span>
            ) : typing ? (
              <span className="text-ink">Анастасия печатает…</span>
            ) : dialogStatus === "closed" ? (
              "Диалог завершён. Если появятся вопросы — напишите, мы продолжим."
            ) : workingHours ? (
              `Отвечаем: ${workingHours.charAt(0).toLowerCase()}${workingHours.slice(1)}`
            ) : (
              "Ответ придёт в этом окне"
            )}
          </p>

          <div
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              if (atBottom.current) setNewBelow(false);
            }}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
            aria-label="Сообщения"
          >
            {hasMore ? (
              <p className="mb-3 text-center">
                <button type="button" onClick={loadEarlier} className="text-[0.8125rem] font-medium text-bronze-deep underline underline-offset-2">
                  Показать предыдущие сообщения
                </button>
              </p>
            ) : null}
            <ol className="space-y-2.5">
              {/* Приветствие — часть интерфейса, в переписке на сервере его нет. */}
              {!hasMore ? (
                <li className="flex justify-start" data-testid="webchat-greeting">
                  <div className="max-w-[85%] rounded-[14px] rounded-bl-[4px] bg-mist px-3.5 py-2.5 text-[0.9375rem] leading-snug text-ink">{GREETING}</div>
                </li>
              ) : null}
              {messages.map((m) => (
                <li key={m.localKey ?? m.id} className={`flex flex-col ${m.from === "visitor" ? "items-end" : "items-start"}`} data-testid={`webchat-message-${m.from}`}>
                  <div
                    className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[0.9375rem] leading-snug break-words whitespace-pre-wrap ${
                      m.from === "visitor" ? "rounded-br-[4px] bg-dark text-white" : "rounded-bl-[4px] bg-mist text-ink"
                    } ${m.state === "failed" ? "opacity-70" : ""}`}
                  >
                    {m.text}
                  </div>
                  <span className="mt-0.5 inline-flex items-center gap-1 px-1 text-[0.6875rem] text-muted">
                    {m.state === "sending" ? (
                      <>
                        <Clock aria-hidden="true" className="h-3 w-3" /> Отправляется…
                      </>
                    ) : m.state === "failed" ? (
                      <span className="inline-flex flex-wrap items-center gap-x-2 text-danger">
                        <AlertCircle aria-hidden="true" className="h-3 w-3" /> Не отправлено
                        <button type="button" onClick={() => retry(m)} className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
                          <RotateCw aria-hidden="true" className="h-3 w-3" /> Повторить
                        </button>
                        <button type="button" onClick={() => discard(m)} className="font-medium text-muted underline underline-offset-2">
                          В поле ввода
                        </button>
                      </span>
                    ) : (
                      <>
                        {formatTime(m.createdAt)}
                        {m.from === "visitor" ? <Check aria-label="доставлено" className="h-3 w-3" /> : null}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {loading ? (
              <p className="mt-3 flex items-center justify-center gap-2 text-[0.8125rem] text-muted">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Загружаем переписку…
              </p>
            ) : null}
          </div>

          {newBelow ? (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute right-1/2 bottom-[7.5rem] inline-flex translate-x-1/2 items-center gap-1 rounded-full bg-dark px-3 py-1.5 text-[0.75rem] font-medium text-white shadow"
            >
              <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> Новые сообщения
            </button>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="shrink-0 border-t border-line bg-white px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
          >
            {notice ? (
              <p role="alert" className="mb-2 text-[0.8125rem] text-danger">
                {notice}
              </p>
            ) : null}
            {hasDialog === false || (hasDialog === null && !messages.length) ? (
              <label className="mb-2 flex items-start gap-2 text-[0.75rem] leading-snug text-muted">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Согласен(на) на обработку персональных данных из переписки на условиях{" "}
                  <Link href={policyHref} target="_blank" className="text-link">
                    политики
                  </Link>
                </span>
              </label>
            ) : null}
            <div className="flex items-end gap-2">
              <label htmlFor="webchat-input" className="sr-only">
                Сообщение консультанту
              </label>
              <textarea
                id="webchat-input"
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={MAX_LENGTH + 200}
                onChange={(e) => {
                  setText(e.target.value);
                  saveDraft(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  // Enter — отправить, Shift+Enter — новая строка; во время набора через IME Enter не отправляет.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Напишите сообщение…"
                className="block max-h-[120px] min-h-11 w-full resize-none rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2.5 text-[16px] leading-snug text-ink focus:border-dark focus:outline-none sm:text-[0.9375rem]"
              />
              <button
                type="submit"
                aria-label="Отправить сообщение"
                disabled={!text.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-dark text-white hover:bg-dark-800 disabled:opacity-40"
              >
                <Send aria-hidden="true" className="h-4.5 w-4.5" />
              </button>
            </div>
            {text.length > MAX_LENGTH - 200 ? (
              <p className={`mt-1 text-right text-[0.6875rem] tabular-nums ${text.length > MAX_LENGTH ? "text-danger" : "text-muted"}`}>
                {text.length}/{MAX_LENGTH}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </>
  );
}
