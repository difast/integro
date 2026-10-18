"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { login, type ActionState } from "@/app/admin/actions";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="space-y-5">
      {state.status === "error" ? (
        <div
          role="alert"
          className="flex gap-3 rounded-[var(--radius-control)] border-l-[3px] border-danger bg-mist p-4 text-[0.9375rem] text-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="font-medium">{state.message}</p>
        </div>
      ) : null}
      <div>
        <label htmlFor="password" className="text-[0.9375rem] font-medium text-ink">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          className="mt-2 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-4 py-3 text-base text-ink focus:border-dark focus:outline-none"
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LogIn aria-hidden="true" className="h-4 w-4" />}
        Войти
      </button>
    </form>
  );
}
