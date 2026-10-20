"use client";

import { useActionState } from "react";
import { Loader2, PlugZap, Unplug, Webhook } from "lucide-react";
import { checkConnection, registerWebhook, removeWebhook, type SetupState } from "@/app/admin/max/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: SetupState = { status: "idle" };

function Result({ state }: { state: SetupState }) {
  return (
    <div className="mt-3 space-y-2">
      <ActionMessage state={state} />
      {state.details?.length ? (
        <ul className="space-y-1 text-[0.875rem] break-words text-muted">
          {state.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SetupActions({ canCheck, canRegister }: { canCheck: boolean; canRegister: boolean }) {
  const [checkState, check, checking] = useActionState(checkConnection, initial);
  const [registerState, register, registering] = useActionState(registerWebhook, initial);
  const [removeState, remove, removing] = useActionState(removeWebhook, initial);

  return (
    <div className="space-y-6">
      <form action={check}>
        <button type="submit" disabled={!canCheck || checking} className={buttonClass("outline", "min-h-11 bg-white px-5")}>
          {checking ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <PlugZap aria-hidden="true" className="h-4 w-4" />}
          Проверить подключение
        </button>
        <Result state={checkState} />
      </form>
      <form action={register}>
        <button type="submit" disabled={!canRegister || registering} className={buttonClass("primary", "min-h-11 px-5")}>
          {registering ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Webhook aria-hidden="true" className="h-4 w-4" />}
          Зарегистрировать Webhook
        </button>
        <Result state={registerState} />
      </form>
      <form action={remove}>
        <button
          type="submit"
          disabled={!canCheck || removing}
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-4 text-[0.875rem] font-medium text-danger transition-colors hover:border-danger disabled:opacity-50"
        >
          {removing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Unplug aria-hidden="true" className="h-4 w-4" />}
          Удалить подписку этого сайта
        </button>
        <Result state={removeState} />
      </form>
    </div>
  );
}
