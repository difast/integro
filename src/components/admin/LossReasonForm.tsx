"use client";

import { useActionState } from "react";
import { saveLossReasonAction, type ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };
const control =
  "block w-full min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";

/** Строка справочника причин отказа: изменение или добавление. Удаления нет — причина отключается, история сохраняется. */
export function LossReasonForm({ reason }: { reason?: { id: number; title: string; active: boolean; sort: number } }) {
  const [state, action, pending] = useActionState(saveLossReasonAction, initial);
  const prefix = reason ? `reason-${reason.id}` : "reason-new";
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-center">
      {reason ? <input type="hidden" name="id" value={reason.id} /> : null}
      <label htmlFor={`${prefix}-title`} className="sr-only">
        Название причины
      </label>
      <input
        id={`${prefix}-title`}
        name="title"
        required
        maxLength={100}
        defaultValue={reason?.title ?? ""}
        placeholder={reason ? undefined : "Новая причина"}
        className={control}
      />
      <label htmlFor={`${prefix}-sort`} className="sr-only">
        Порядок
      </label>
      <input id={`${prefix}-sort`} name="sort" type="number" step={1} defaultValue={reason?.sort ?? 90} className={control} />
      <label className="inline-flex min-h-10 items-center gap-2 text-[0.875rem] text-ink">
        <input type="checkbox" name="active" defaultChecked={reason?.active ?? true} className="h-4 w-4" />
        Используется
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-dark px-4 text-[0.875rem] font-medium text-white hover:bg-ink disabled:opacity-50"
      >
        {reason ? "Сохранить" : "Добавить"}
      </button>
      <div className="sm:col-span-4">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
