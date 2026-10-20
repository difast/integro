"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendReply, type ReplyState } from "@/app/admin/max/actions";
import { REPLY_MAX_LENGTH } from "@/lib/max/filters";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ReplyState = { status: "idle" };

/**
 * Ответ оператора. Ключ отправки создаётся при открытии формы и меняется только после того,
 * как сервер обработал ответ с этим ключом: двойное нажатие или повтор запроса не отправят
 * сообщение дважды. После обработки (в том числе с ошибкой) поле очищается — неотправленное
 * сообщение остаётся в истории, и его можно повторить оттуда.
 */
export function ReplyForm({ clientId, disabledReason }: { clientId: string; disabledReason: string | null }) {
  const [state, action, pending] = useActionState(sendReply, initial);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [text, setText] = useState("");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (state.resetKey && state.resetKey !== handled.current) {
      handled.current = state.resetKey;
      setKey(crypto.randomUUID());
      setText("");
    }
  }, [state]);

  if (disabledReason) {
    return <p className="rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist px-4 py-3 text-[0.9375rem] text-ink">{disabledReason}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <label htmlFor="reply" className="text-[0.9375rem] font-medium text-ink">
        Ответ клиенту
      </label>
      <textarea
        id="reply"
        name="text"
        rows={4}
        required
        maxLength={REPLY_MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby="reply-hint"
        className="block w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
      />
      <p id="reply-hint" className="text-[0.8125rem] text-muted">
        Сообщение уйдёт клиенту в MAX от имени бота. После отправки диалог переходит в режим оператора — бот перестаёт
        отвечать автоматически. Не запрашивайте паспортные данные и платёжные реквизиты.
        <span className="ml-1 tabular-nums">{text.length}/{REPLY_MAX_LENGTH}</span>
      </p>
      <ActionMessage state={state} />
      <button type="submit" disabled={pending || !text.trim()} className={buttonClass("primary", "min-h-11 px-5")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
        Отправить в MAX
      </button>
    </form>
  );
}
