import Link from "next/link";
import { company } from "@/config/company";
import { placementLabels } from "@/lib/stats/clicks";
import type { MessengerClickSummary } from "@/lib/stats/repository";
import { formatMoscowDateTime } from "@/lib/requests/csv";

/**
 * WhatsApp в разделе «Обращения»: у компании обычный аккаунт WhatsApp, а не бот, поэтому переписка ведётся
 * в самом приложении WhatsApp, а здесь — статистика нажатий на кнопку WhatsApp на сайте.
 */
export function WhatsAppPanel({ summary }: { summary: MessengerClickSummary }) {
  const link = company.contacts.messengers.whatsapp.href;
  const cards = [
    { label: "Сегодня", value: summary.today, id: "wa-today" },
    { label: "7 дней", value: summary.last7, id: "wa-7" },
    { label: "30 дней", value: summary.last30, id: "wa-30" },
    { label: "Всё время", value: summary.total, id: "wa-total" },
  ];
  const max = summary.topPages[0]?.count ?? 0;

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-[var(--radius-card)] bg-white px-5 py-4 text-[0.9375rem] text-ink">
        WhatsApp подключён как обычный аккаунт компании{company.contacts.phone ? ` (${company.contacts.phone})` : ""}, без бота:
        переписка ведётся в приложении WhatsApp и в админку не попадает. Здесь — сколько раз посетители нажали кнопку
        WhatsApp на сайте. Нажатие не означает, что человек написал.
        {link ? (
          <>
            {" "}
            Ссылка кнопки:{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-link break-all">
              {link}
            </a>
            .
          </>
        ) : null}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card, index) => (
          <div key={card.id} className={`rounded-[var(--radius-card)] px-5 py-3 ${index === 0 ? "bg-dark text-white" : "bg-white"}`}>
            <dt className={`flex items-center gap-2 text-[0.8125rem] ${index === 0 ? "text-on-dark" : "text-muted"}`}>
              {index === 0 ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#25D366]" /> : null}
              {card.label}
            </dt>
            <dd className={`text-[1.5rem] leading-tight font-medium ${index === 0 ? "" : "text-ink"}`} data-testid={card.id}>
              {card.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[0.875rem] text-muted">
        Последнее нажатие: {summary.lastClickAt ? `${formatMoscowDateTime(summary.lastClickAt)} (МСК)` : "нажатий пока не было"}.{" "}
        <Link href="/admin/statistika" className="text-link">
          Подробная статистика по всем мессенджерам
        </Link>
      </p>

      {summary.last30 > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="wa-placement" className="min-w-0 rounded-[var(--radius-card)] bg-white p-5">
            <h2 id="wa-placement" className="text-[0.875rem] font-medium text-muted">
              Где нажимали (30 дней)
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {summary.byPlacement.map((row) => (
                <li key={row.placement} className="flex justify-between gap-4 py-2.5 text-[0.9375rem]">
                  <span className="text-ink">{placementLabels[row.placement]}</span>
                  <span className="font-medium tabular-nums text-ink">{row.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="wa-pages" className="min-w-0 rounded-[var(--radius-card)] bg-white p-5">
            <h2 id="wa-pages" className="text-[0.875rem] font-medium text-muted">
              С каких страниц (30 дней)
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {summary.topPages.map((row) => (
                <li key={row.path} className="py-2.5">
                  <span className="flex justify-between gap-4 text-[0.9375rem]">
                    <a href={row.path} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-ink hover:text-bronze-deep">
                      {row.path}
                    </a>
                    <span className="shrink-0 font-medium tabular-nums text-ink">{row.count}</span>
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded-full bg-mist">
                    <span className="block h-full rounded-full bg-[#25D366]" style={{ width: `${max ? Math.max(2, (row.count / max) * 100) : 0}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
