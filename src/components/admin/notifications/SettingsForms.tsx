"use client";

import { useActionState } from "react";
import { Link2, Loader2, Send, Trash2 } from "lucide-react";
import { createTelegramLinkAction, markRead, removeRecipientAction, saveSettings, sendTestNotification, type LinkState } from "@/app/admin/uvedomleniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

export function TelegramLink({ disabledReason }: { disabledReason: string | null }) {
  const [state, action, pending] = useActionState<LinkState>(createTelegramLinkAction, initial);
  if (disabledReason) return <p className="text-[0.9375rem] text-muted">{disabledReason}</p>;
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className={buttonClass("primary", "min-h-11 px-5")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
        Создать ссылку для подключения
      </button>
      {state.url ? (
        <p className="rounded-[var(--radius-control)] bg-mist px-4 py-3 text-[0.9375rem] text-ink">
          Откройте ссылку с телефона или компьютера, где установлен Telegram сотрудника, и нажмите «Старт»:{" "}
          <a href={state.url} target="_blank" rel="noopener noreferrer" className="text-link break-all" data-testid="tg-link">
            {state.url}
          </a>
        </p>
      ) : null}
      <ActionMessage state={state} />
    </form>
  );
}

export function RemoveRecipient({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeRecipientAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1 text-[0.8125rem] text-danger">
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Отключить
      </button>
      {state.status === "error" ? <span className="ml-2 text-[0.8125rem] text-danger">{state.message}</span> : null}
    </form>
  );
}

export function TestNotification() {
  const [state, action, pending] = useActionState(sendTestNotification, initial);
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className={buttonClass("outline", "min-h-11 bg-white px-5")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
        Отправить тестовое уведомление
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function NotificationSettingsForm({
  types,
  selected,
  throttle,
}: {
  types: { value: string; label: string }[];
  selected: { push: string[]; telegram: string[] };
  throttle: number;
}) {
  const [state, action, pending] = useActionState(saveSettings, initial);
  return (
    <form action={action} className="space-y-5">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[0.9375rem]">
          <thead>
            <tr className="border-b border-line text-[0.8125rem] text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Событие</th>
              <th scope="col" className="px-3 py-2 text-center font-medium">Push</th>
              <th scope="col" className="px-3 py-2 text-center font-medium">Telegram</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.value} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 pr-3 font-normal text-ink">{type.label}</th>
                {(["push", "telegram"] as const).map((transport) => (
                  <td key={transport} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      name={transport}
                      value={type.value}
                      defaultChecked={selected[transport].includes(type.value)}
                      aria-label={`${type.label}: ${transport === "push" ? "push" : "Telegram"}`}
                      className="h-4 w-4 accent-[var(--color-dark)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[0.8125rem] text-muted">В центре уведомлений админки показываются все события независимо от этих настроек.</p>
      <label className="block max-w-xs text-[0.9375rem] text-ink">
        «Новое сообщение» по одному диалогу — не чаще одного раза за, минут
        <input
          type="number"
          name="throttle"
          min={1}
          max={1440}
          defaultValue={throttle}
          className="mt-2 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-ink focus:border-dark focus:outline-none"
        />
      </label>
      <ActionMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass("primary", "min-h-11 px-5")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Сохранить настройки
      </button>
    </form>
  );
}

export function MarkReadButton({ id, label = "Прочитано" }: { id: string; label?: string }) {
  const [state, action, pending] = useActionState(markRead, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={id === "all" ? buttonClass("outline", "min-h-10 bg-white px-4") : "text-[0.8125rem] text-link"}>
        {label}
      </button>
      {state.status === "error" ? <span className="ml-2 text-[0.8125rem] text-danger">{state.message}</span> : null}
    </form>
  );
}
