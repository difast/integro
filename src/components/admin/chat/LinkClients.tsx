"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Link2, Unlink } from "lucide-react";
import { linkClients, unlinkClient } from "@/app/admin/obrashcheniya/actions";
import type { ActionState } from "@/app/admin/actions";
import { ActionMessage } from "@/components/admin/RequestEditor";
import { buttonClass } from "@/components/ui/Button";

const initial: ActionState = { status: "idle" };

type Card = { id: string; name: string; channelLabel: string; externalUserId: string };

/**
 * Ручная связь карточек одного человека из разных каналов. Автоматически карточки не объединяются
 * (совпадение имени не означает, что это один человек); данные и переписка остаются в своих карточках.
 */
export function LinkClients({
  clientId,
  linked,
  candidates,
  query,
}: {
  clientId: string;
  linked: Card[];
  candidates: Card[];
  query: string;
}) {
  const [linkState, linkAction, linking] = useActionState(linkClients, initial);
  const [unlinkState, unlinkAction, unlinking] = useActionState(unlinkClient, initial);

  return (
    <div className="space-y-4">
      {linked.length ? (
        <ul className="divide-y divide-line">
          {linked.map((card) => (
            <li key={card.id} className="py-2">
              <Link href={`/admin/obrashcheniya/${card.id}`} className="text-[0.9375rem] text-link">
                {card.name}
              </Link>
              <span className="ml-2 text-[0.8125rem] text-muted">
                {card.channelLabel}, ID {card.externalUserId}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.875rem] text-muted">Связанных карточек нет. Связывайте, только если уверены, что это один человек.</p>
      )}
      {linked.length ? (
        <form action={unlinkAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <button type="submit" disabled={unlinking} className={buttonClass("outline", "min-h-10 bg-white px-4")}>
            <Unlink aria-hidden="true" className="h-4 w-4" />
            Отвязать эту карточку
          </button>
          <div className="mt-2">
            <ActionMessage state={unlinkState} />
          </div>
        </form>
      ) : null}

      <form method="get" className="flex gap-2">
        <label htmlFor="link-q" className="sr-only">
          Найти карточку для связи
        </label>
        <input
          id="link-q"
          name="link"
          type="search"
          defaultValue={query}
          maxLength={100}
          placeholder="Имя, ID или телефон"
          className="block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
        />
        <button type="submit" className={buttonClass("outline", "min-h-10 shrink-0 bg-white px-4")}>
          Найти
        </button>
      </form>
      {query ? (
        candidates.length ? (
          <ul className="divide-y divide-line">
            {candidates.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 text-[0.9375rem] text-ink">
                  {card.name}
                  <span className="ml-2 text-[0.8125rem] text-muted">
                    {card.channelLabel}, ID {card.externalUserId}
                  </span>
                </span>
                <form action={linkAction}>
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="otherId" value={card.id} />
                  <button type="submit" disabled={linking} className={buttonClass("outline", "min-h-9 shrink-0 bg-white px-3 text-[0.8125rem]")}>
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                    Связать
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.875rem] text-muted">Ничего не найдено.</p>
        )
      ) : null}
      <ActionMessage state={linkState} />
    </div>
  );
}
