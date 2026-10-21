"use client";

import { useActionState } from "react";
import { saveDirectionsAction } from "@/app/admin/plan-prodazh/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };

/** Названия направлений. Идентификаторы и правила расчёта не меняются — только подписи. */
export function DirectionsForm({ directions }: { directions: { id: string; title: string; services: string }[] }) {
  const [state, action, pending] = useActionState(saveDirectionsAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {directions.map((d) => (
          <label key={d.id} className="block min-w-0 text-[0.8125rem] font-medium text-ink">
            Название
            <input
              name={`title_${d.id}`}
              defaultValue={d.title}
              required
              maxLength={100}
              className="mt-1 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-[0.9375rem] focus:border-dark focus:outline-none"
            />
            <span className="mt-1 block text-[0.75rem] font-normal text-muted">Новые заявки по услуге: {d.services || "не назначены"}</span>
          </label>
        ))}
      </div>
      <ActionMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink hover:border-dark disabled:opacity-50"
      >
        Сохранить названия
      </button>
    </form>
  );
}
