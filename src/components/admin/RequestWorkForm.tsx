"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { saveRequest, type ActionState } from "@/app/admin/actions";
import { CURRENCIES, paymentStatuses, requestChannels, requestStages } from "@/lib/requests/funnel";
import { requestStatuses, NOTES_MAX_LENGTH } from "@/lib/requests/statuses";
import type { RequestRecord } from "@/lib/requests/repository";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };
const control =
  "mt-1.5 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";
const label = "block text-[0.875rem] font-medium text-ink";

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-line pt-4">
      <legend className="pr-2 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Работа с заявкой: статус, ответственный, этап воронки, сделка, оплата, источник, заметки. */
export function RequestWorkForm({
  request,
  lossReasons,
  assignees,
}: {
  request: RequestRecord;
  lossReasons: { id: number; title: string }[];
  assignees: string[];
}) {
  const [state, action, pending] = useActionState(saveRequest, initial);
  const [stage, setStage] = useState(request.stage);
  const [payment, setPayment] = useState(request.paymentStatus);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={request.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Статус обработки
          <select name="status" defaultValue={request.status} className={control}>
            {requestStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Ответственный
          <input name="assignee" list="assignees" maxLength={100} defaultValue={request.assignee ?? ""} placeholder="Имя сотрудника" className={control} />
          <datalist id="assignees">
            {assignees.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
      </div>

      <Fieldset legend="Воронка">
        <label className={label}>
          Этап
          <select name="stage" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={control}>
            {requestStages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {stage === "lost" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Причина потери
              <select name="lossReasonId" defaultValue={request.lossReasonId ?? ""} required className={control}>
                <option value="">Выберите…</option>
                {lossReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Комментарий
              <input name="lossComment" maxLength={500} defaultValue={request.lossComment ?? ""} className={control} />
            </label>
          </div>
        ) : null}
      </Fieldset>

      <Fieldset legend="Сделка">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`${label} sm:col-span-1`}>
            Сумма по договору
            <input name="dealAmount" inputMode="decimal" defaultValue={request.dealAmount ?? ""} placeholder="0" className={control} />
          </label>
          <label className={label}>
            Валюта
            <select name="currency" defaultValue={request.currency} className={control}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Дата договора
            <input name="contractDate" type="date" defaultValue={request.contractDate ?? ""} className={control} />
          </label>
        </div>
        <p className="text-[0.8125rem] text-muted">Сумма по договору — договорная стоимость; выручка считается только по полученной оплате.</p>
      </Fieldset>

      <Fieldset legend="Оплата">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Статус оплаты
            <select name="paymentStatus" value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)} className={control}>
              {paymentStatuses.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Получено
            <input name="paidAmount" inputMode="decimal" defaultValue={request.paidAmount ?? ""} required={payment !== "none"} placeholder="0" className={control} />
          </label>
          <label className={label}>
            Дата поступления
            <input name="paidAt" type="date" defaultValue={request.paidAt ?? ""} className={control} />
          </label>
        </div>
      </Fieldset>

      <Fieldset legend="Источник">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Канал
            <select name="channel" defaultValue={request.channel} className={control}>
              {requestChannels.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Уточнение источника
            <input name="sourceNote" maxLength={200} defaultValue={request.sourceNote ?? ""} placeholder="Например: рекомендация, выставка" className={control} />
          </label>
        </div>
        <p className="text-[0.8125rem] text-muted">Изменение источника и других полей сохраняется в истории заявки.</p>
      </Fieldset>

      <Fieldset legend="Заметки">
        <label htmlFor="notes" className="sr-only">
          Внутренние заметки
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={NOTES_MAX_LENGTH}
          defaultValue={request.notes}
          aria-label="Внутренние заметки"
          placeholder="Видны только в панели. Не записывайте лишние персональные данные."
          className={`${control} mt-0 resize-y`}
        />
      </Fieldset>

      <ActionMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass("primary", "min-h-11 w-full px-5 sm:w-auto")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Сохранить
      </button>
    </form>
  );
}
