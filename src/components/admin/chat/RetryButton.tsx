"use client";

import { useActionState, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { retryMessage } from "@/app/admin/obrashcheniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };
const small =
  "inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.8125rem] font-medium text-ink transition-colors hover:border-dark disabled:opacity-50";

/** Повтор: при ошибке — сразу, при неизвестном результате — после подтверждения. */
export function RetryButton({ clientId, messageId, unknown }: { clientId: string; messageId: string; unknown: boolean }) {
  const [state, action, pending] = useActionState(retryMessage, initial);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="messageId" value={messageId} />
      {unknown ? (
        <label className="flex items-start gap-2 text-[0.8125rem] text-ink">
          <input
            type="checkbox"
            name="confirmUnknown"
            value="yes"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-dark)]"
          />
          Понимаю, что сообщение могло уже дойти, и клиент может получить его дважды
        </label>
      ) : null}
      <button type="submit" disabled={pending || (unknown && !confirmed)} className={small}>
        {pending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />}
        {unknown ? "Отправить повторно" : "Повторить отправку"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
