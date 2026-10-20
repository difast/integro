"use client";

import { useActionState } from "react";
import { DatabaseBackup, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { backupNow, checkIntegrationsNow, retryOperation, saveRetention } from "@/app/admin/sistema/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

export function CheckNow() {
  const [state, action, pending] = useActionState(checkIntegrationsNow, initial);
  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={pending} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
        Проверить подключение сейчас
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function BackupButtons({ s3Ready, keyReady }: { s3Ready: boolean; keyReady: boolean }) {
  const [state, action, pending] = useActionState(backupNow, initial);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
      <form action={action} className="space-y-2">
        <button type="submit" disabled={pending || !s3Ready || !keyReady} className={buttonClass("primary", "min-h-11 px-5")}>
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <DatabaseBackup aria-hidden="true" className="h-4 w-4" />}
          Создать копию в хранилище
        </button>
        <ActionMessage state={state} />
      </form>
      <form method="post" action="/api/admin/backup">
        <button type="submit" disabled={!keyReady} className={buttonClass("outline", "min-h-11 bg-white px-5")}>
          Скачать зашифрованную копию
        </button>
      </form>
    </div>
  );
}

export function RetryOperation({ kind, id }: { kind: "event" | "delivery"; id: string }) {
  const [state, action, pending] = useActionState(retryOperation, initial);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-link">
        {pending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />}
        Повторить
      </button>
      {state.status !== "idle" ? <p className={`text-[0.75rem] ${state.status === "error" ? "text-danger" : "text-muted"}`}>{state.message}</p> : null}
    </form>
  );
}

export function RetentionForm({ chatDays, requestDays }: { chatDays: number | null; requestDays: number | null }) {
  const [state, action, pending] = useActionState(saveRetention, initial);
  const input =
    "mt-1.5 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-[0.9375rem] text-ink">
        Удалять закрытые диалоги с перепиской, неактивные дольше, дней
        <input type="number" name="chatDays" min={30} max={3650} defaultValue={chatDays ?? ""} placeholder="не удалять" className={input} />
      </label>
      <label className="text-[0.9375rem] text-ink">
        Удалять завершённые и отклонённые заявки, не изменявшиеся дольше, дней
        <input type="number" name="requestDays" min={30} max={3650} defaultValue={requestDays ?? ""} placeholder="не удалять" className={input} />
      </label>
      <div className="space-y-2 sm:col-span-2">
        <ActionMessage state={state} />
        <button type="submit" disabled={pending} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
          Сохранить сроки хранения
        </button>
      </div>
    </form>
  );
}
