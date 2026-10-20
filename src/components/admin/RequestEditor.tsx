"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { removeRequest, saveRequest, type ActionState } from "@/app/admin/actions";
import { requestStatuses, NOTES_MAX_LENGTH, type RequestStatus } from "@/lib/requests/statuses";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const ok = state.status === "success";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`flex gap-2 rounded-[var(--radius-control)] border-l-[3px] bg-mist px-4 py-3 text-[0.9375rem] font-medium text-ink ${ok ? "border-dark" : "border-danger"}`}
    >
      {ok ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      )}
      {state.message}
    </p>
  );
}

export function RequestEditor({ id, status, notes }: { id: string; status: RequestStatus; notes: string }) {
  const [saveState, saveAction, saving] = useActionState(saveRequest, initial);

  return (
    <form action={saveAction} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="status" className="text-[0.9375rem] font-medium text-ink">
          Статус
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="mt-2 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
        >
          {requestStatuses.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="text-[0.9375rem] font-medium text-ink">
          Внутренние заметки
        </label>
        <p id="notes-hint" className="mt-1 text-[0.8125rem] text-muted">
          Видны только в панели заявок. Не записывайте сведения, не нужные для работы с обращением.
        </p>
        <textarea
          id="notes"
          name="notes"
          rows={6}
          maxLength={NOTES_MAX_LENGTH}
          defaultValue={notes}
          aria-describedby="notes-hint"
          className="mt-2 block w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
        />
      </div>
      <ActionMessage state={saveState} />
      <button type="submit" disabled={saving} className={buttonClass("primary", "min-h-11 px-5")}>
        {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Сохранить
      </button>
    </form>
  );
}

export function DeleteRequest({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeRequest, initial);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-4 text-[0.875rem] font-medium text-danger transition-colors hover:border-danger"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Удалить заявку
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-control)] border border-danger/40 p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirm" value="yes" />
      <p className="text-[0.9375rem] font-medium text-ink">Удалить заявку без возможности восстановления?</p>
      <ActionMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-danger px-4 text-[0.875rem] font-medium text-white disabled:opacity-50"
        >
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
          Да, удалить
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-line-strong px-4 text-[0.875rem] font-medium text-ink"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
