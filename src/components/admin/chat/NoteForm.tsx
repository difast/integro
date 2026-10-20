"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { addNote } from "@/app/admin/obrashcheniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

export function NoteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(addNote, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <label htmlFor="note" className="sr-only">
        Внутренняя заметка
      </label>
      <textarea
        id="note"
        name="body"
        rows={3}
        maxLength={5000}
        required
        placeholder="Видна только сотрудникам, клиенту не отправляется"
        className="block w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
      />
      <ActionMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Добавить заметку
      </button>
    </form>
  );
}
