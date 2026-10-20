"use client";

import { useActionState } from "react";
import { BadgeCheck, Bot, CheckCheck, CircleDot, Headset, Lock, LockOpen } from "lucide-react";
import { updateDialog } from "@/app/admin/obrashcheniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";

const initial: ActionState = { status: "idle" };
const btn =
  "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.875rem] font-medium text-ink transition-colors hover:border-dark disabled:opacity-50";

export function DialogControls({
  clientId,
  mode,
  status,
  needsReply,
  qualified,
  hasRequest,
}: {
  clientId: string;
  mode: "bot" | "operator";
  status: "open" | "closed";
  needsReply: boolean;
  qualified: boolean;
  hasRequest: boolean;
}) {
  const [state, action, pending] = useActionState(updateDialog, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div>
        <p className="text-[0.9375rem] font-medium text-ink">Режим</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {mode === "operator"
            ? "Оператор: бот не отвечает автоматически, все сообщения клиента ждут ответа специалиста."
            : "Бот: отвечает по сценарию, помогает оформить заявку."}
        </p>
        <div className="mt-2">
          {mode === "operator" ? (
            <button type="submit" name="action" value="bot" disabled={pending} className={btn}>
              <Bot aria-hidden="true" className="h-4 w-4" />
              Вернуть диалог боту
            </button>
          ) : (
            <button type="submit" name="action" value="operator" disabled={pending} className={btn}>
              <Headset aria-hidden="true" className="h-4 w-4" />
              Взять в работу (режим оператора)
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {needsReply ? (
          <button type="submit" name="action" value="replied" disabled={pending} className={btn}>
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
            Снять «нужен ответ»
          </button>
        ) : (
          <button type="submit" name="action" value="needs_reply" disabled={pending} className={btn}>
            <CircleDot aria-hidden="true" className="h-4 w-4" />
            Нужен ответ
          </button>
        )}
        {status === "open" ? (
          <button type="submit" name="action" value="close" disabled={pending} className={btn}>
            <Lock aria-hidden="true" className="h-4 w-4" />
            Закрыть диалог
          </button>
        ) : (
          <button type="submit" name="action" value="reopen" disabled={pending} className={btn}>
            <LockOpen aria-hidden="true" className="h-4 w-4" />
            Вернуть в работу
          </button>
        )}
      </div>
      <div>
        <p className="text-[0.9375rem] font-medium text-ink">Квалификация</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {hasRequest
            ? "По обращению есть заявка — в аналитике оно считается квалифицированным лидом."
            : qualified
              ? "Отмечено как квалифицированный лид: потребность и контакт подтверждены."
              : "Отметьте, если потребность клиента понятна и подходит под услуги компании."}
        </p>
        <div className="mt-2">
          <button
            type="submit"
            name="action"
            value={qualified ? "unqualify" : "qualify"}
            disabled={pending}
            aria-pressed={qualified}
            className={btn}
          >
            <BadgeCheck aria-hidden="true" className="h-4 w-4" />
            {qualified ? "Снять отметку «квалифицированный лид»" : "Квалифицированный лид"}
          </button>
        </div>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
