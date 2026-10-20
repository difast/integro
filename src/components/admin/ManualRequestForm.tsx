"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createManualRequest, type ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };
const control =
  "mt-1.5 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";
const label = "block text-[0.875rem] font-medium text-ink";

/**
 * Регистрация заявки сотрудником: обращение по WhatsApp, Авито, телефону, почте — или из диалога MAX/Telegram
 * (тогда канал и клиент подставляются из карточки, chatClientId).
 */
export function ManualRequestForm({
  channels,
  services,
  chatClientId,
  defaults,
}: {
  channels: { value: string; label: string }[];
  services: { value: string; label: string }[];
  chatClientId?: string;
  defaults?: { name?: string; phone?: string };
}) {
  const [state, action, pending] = useActionState(createManualRequest, initial);
  return (
    <form action={action} className="space-y-3">
      {chatClientId ? <input type="hidden" name="chatClientId" value={chatClientId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {chatClientId ? null : (
          <label className={label}>
            Канал обращения
            <select name="channel" required defaultValue="" className={control}>
              <option value="" disabled>
                Выберите…
              </option>
              {channels.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={label}>
          Направление
          <select name="service" defaultValue="" className={control}>
            <option value="">Не выбрано</option>
            {services.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Имя клиента
          <input name="name" required minLength={2} maxLength={100} defaultValue={defaults?.name ?? ""} className={control} />
        </label>
        <label className={label}>
          Телефон
          <input name="phone" type="tel" maxLength={30} defaultValue={defaults?.phone ?? ""} className={control} />
        </label>
        <label className={label}>
          Электронная почта
          <input name="email" type="email" maxLength={120} className={control} />
        </label>
        <label className={label}>
          Уточнение источника
          <input name="sourceNote" maxLength={200} placeholder="Например: объявление на Авито" className={control} />
        </label>
      </div>
      <label className={label}>
        Суть обращения
        <textarea name="message" required minLength={5} maxLength={3000} rows={3} className={`${control} resize-y`} />
      </label>
      <p className="text-[0.8125rem] text-muted">
        Вносите только данные, которые клиент сообщил сам и которые нужны для работы с обращением. Согласие на обработку
        персональных данных при обращении вне сайта фиксирует сотрудник.
      </p>
      <ActionMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass("primary", "min-h-11 w-full px-5 sm:w-auto")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Создать заявку
      </button>
    </form>
  );
}
