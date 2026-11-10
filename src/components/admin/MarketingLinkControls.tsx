"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createLinkAction, toggleLinkAction } from "@/app/admin/marketing/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };
const control =
  "mt-1 block w-full min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";
const buttonDark =
  "inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-dark px-4 text-[0.875rem] font-medium text-white hover:bg-ink disabled:opacity-50";

/** Копирование короткой ссылки в буфер обмена. */
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Скопировать ссылку: ${label}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.8125rem] font-medium text-ink hover:border-dark"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Скопировано" : "Скопировать"}</span>
    </button>
  );
}

/** Включение и отключение ссылки. Отключённая ведёт на главную и переходы не считает; статистика сохраняется. */
export function ToggleLinkForm({ id, active, title }: { id: number; active: boolean; title: string }) {
  const [state, action, pending] = useActionState(toggleLinkAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${active ? "Отключить" : "Включить"} ссылку: ${title}`}
        className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.8125rem] font-medium text-ink hover:border-dark disabled:opacity-50"
      >
        {active ? "Отключить" : "Включить"}
      </button>
      {state.status === "error" ? <ActionMessage state={state} /> : null}
    </form>
  );
}

/** Новая ссылка: название, чья, площадка (utm_source), страница сайта. */
export function CreateLinkForm() {
  const [state, action, pending] = useActionState(createLinkAction, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-[0.875rem] font-medium text-ink">
        Название
        <input name="title" required maxLength={100} placeholder="Instagram — Вера (HR)" className={control} />
      </label>
      <label className="text-[0.875rem] font-medium text-ink">
        Чья ссылка
        <input name="ownerLabel" maxLength={100} placeholder="Вера, HR" className={control} />
      </label>
      <label className="text-[0.875rem] font-medium text-ink">
        Короткое имя (будет в адресе /go/…)
        <input name="slug" required maxLength={40} pattern="[a-z0-9][a-z0-9\-]{1,39}" placeholder="instagram-vera" className={control} />
      </label>
      <label className="text-[0.875rem] font-medium text-ink">
        Площадка (utm_source)
        <input name="utmSource" required maxLength={40} placeholder="instagram" className={control} />
      </label>
      <label className="text-[0.875rem] font-medium text-ink">
        Страница сайта
        <input name="targetPath" maxLength={200} defaultValue="/" className={control} />
      </label>
      <label className="text-[0.875rem] font-medium text-ink">
        Кампания (utm_campaign, необязательно)
        <input name="utmCampaign" maxLength={40} placeholder="vesna-2027" className={control} />
      </label>
      <input type="hidden" name="utmMedium" value="social" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonDark}>
          Добавить ссылку
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
