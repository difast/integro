"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendReply, type ReplyState } from "@/app/admin/obrashcheniya/actions";
import { REPLY_MAX_LENGTH } from "@/lib/chat/filters";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ReplyState = { status: "idle" };
const draftKey = (clientId: string) => `integro-reply-draft:${clientId}`;

function writeDraft(clientId: string, value: string) {
  try {
    if (value) sessionStorage.setItem(draftKey(clientId), value);
    else sessionStorage.removeItem(draftKey(clientId));
  } catch {
    // Хранилище недоступно (приватный режим) — черновик живёт только в состоянии формы.
  }
}

/**
 * Ответ оператора. Ключ отправки создаётся при открытии формы и меняется только после того,
 * как сервер обработал ответ с этим ключом: двойное нажатие или повтор запроса не отправят
 * сообщение дважды. После обработки (в том числе с ошибкой) поле очищается — неотправленное
 * сообщение остаётся в истории, и его можно повторить оттуда.
 *
 * Черновик хранится в sessionStorage этой вкладки (по карточке клиента): автообновление страницы,
 * переход в другой раздел или перезагрузка не стирают набранный текст. Закрытие вкладки — стирает.
 */
export function ReplyForm({ clientId, channelLabel, disabledReason }: { clientId: string; channelLabel: string; disabledReason: string | null }) {
  const [state, action, pending] = useActionState(sendReply, initial);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [text, setText] = useState("");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey(clientId));
      // Восстановление черновика из хранилища браузера возможно только после монтирования.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setText(saved.slice(0, REPLY_MAX_LENGTH));
    } catch {
      // см. writeDraft
    }
  }, [clientId]);

  useEffect(() => {
    if (state.resetKey && state.resetKey !== handled.current) {
      handled.current = state.resetKey;
      setKey(crypto.randomUUID());
      setText("");
      writeDraft(clientId, "");
    }
  }, [state, clientId]);

  if (disabledReason) {
    return <p className="rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist px-4 py-3 text-[0.9375rem] text-ink">{disabledReason}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <label htmlFor="reply" className="sr-only">
        Ответ клиенту
      </label>
      <textarea
        id="reply"
        name="text"
        rows={3}
        required
        maxLength={REPLY_MAX_LENGTH}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          writeDraft(clientId, event.target.value);
        }}
        onFocus={(event) => {
          // На телефоне экранная клавиатура появляется с задержкой — после неё возвращаем поле в видимую область.
          const field = event.currentTarget;
          window.setTimeout(() => field.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
        }}
        aria-describedby="reply-hint"
        placeholder={`Ответ клиенту в ${channelLabel}`}
        onKeyDown={(event) => {
          // Ctrl+Enter (⌘+Enter) — отправить.
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && text.trim()) event.currentTarget.form?.requestSubmit();
        }}
        className="block w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
      />
      <ActionMessage state={state} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="reply-hint" className="max-w-md text-[0.75rem] text-muted">
          Уйдёт от имени бота; диалог перейдёт в режим оператора. Ctrl+Enter — отправить. Не запрашивайте паспортные
          данные и реквизиты. <span className="tabular-nums">{text.length}/{REPLY_MAX_LENGTH}</span>
        </p>
        <button type="submit" disabled={pending || !text.trim()} className={buttonClass("primary", "min-h-11 px-5")}>
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
          Отправить в {channelLabel}
        </button>
      </div>
    </form>
  );
}
