"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { removeClient } from "@/app/admin/obrashcheniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };

export function DeleteClient({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeClient, initial);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-4 text-[0.875rem] font-medium text-danger transition-colors hover:border-danger"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Удалить карточку и переписку
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-control)] border border-danger/40 p-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="confirm" value="yes" />
      <p className="text-[0.9375rem] font-medium text-ink">
        Удалить карточку клиента, всю переписку и заметки без возможности восстановления? Заявки останутся в разделе «Заявки».
      </p>
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
