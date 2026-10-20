import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Download, ListChecks } from "lucide-react";
import { services } from "@/config/services";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import {
  filtersToSearch,
  formatDuration,
  formatMoney,
  formatPercent,
  hasRequestOnlyFilters,
  parseAnalyticsFilters,
  type AnalyticsFilters,
  type Ratio,
} from "@/lib/analytics/filters";
import { getAnalyticsReport, type AnalyticsReport } from "@/lib/analytics/repository";
import { paymentStatuses, requestChannels, requestStages } from "@/lib/requests/funnel";
import { listAssignees, listLossReasons } from "@/lib/requests/repository";
import { requestStatuses } from "@/lib/requests/statuses";

export const metadata: Metadata = { title: "Аналитика" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const control =
  "mt-1 block w-full min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-[0.875rem] text-ink focus:border-dark focus:outline-none";
const labelClass = "block min-w-0 text-[0.8125rem] font-medium text-muted";

async function load(filters: AnalyticsFilters) {
  try {
    const [report, reasons, assignees] = await Promise.all([getAnalyticsReport(filters), listLossReasons(true), listAssignees()]);
    return { report, reasons, assignees };
  } catch (error) {
    console.error("[admin] failed to load analytics:", describeDbError(error));
    return null;
  }
}

function Card({ title, value, hint, testId }: { title: string; value: ReactNode; hint?: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] bg-white px-4 py-3 sm:px-5">
      <dt className="text-[0.8125rem] text-muted">{title}</dt>
      <dd className="mt-0.5 text-[1.375rem] leading-tight font-medium break-words text-ink tabular-nums" data-testid={testId}>
        {value}
      </dd>
      {hint ? <dd className="mt-1 text-[0.75rem] text-muted">{hint}</dd> : null}
    </div>
  );
}

const fraction = (r: Ratio) => `${r.numerator} из ${r.denominator}`;

function Section({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 min-w-0">
      <h2 id={id} className="text-[1.25rem]">
        {title}
      </h2>
      {note ? <p className="mt-1 max-w-3xl text-[0.8125rem] text-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FiltersForm({ f, reasons, assignees }: { f: AnalyticsFilters; reasons: { id: number; title: string }[]; assignees: string[] }) {
  return (
    <form method="get" className="mt-6 rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <label className={labelClass}>
          С
          <input type="date" name="from" defaultValue={f.from} className={control} />
        </label>
        <label className={labelClass}>
          По
          <input type="date" name="to" defaultValue={f.to} className={control} />
        </label>
        <label className={labelClass}>
          Канал
          <select name="channel" defaultValue={f.channel ?? ""} className={control}>
            <option value="">Все</option>
            {requestChannels.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Услуга
          <select name="service" defaultValue={f.service ?? ""} className={control}>
            <option value="">Все</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Этап
          <select name="stage" defaultValue={f.stage ?? ""} className={control}>
            <option value="">Все</option>
            {requestStages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Статус обработки
          <select name="status" defaultValue={f.status ?? ""} className={control}>
            <option value="">Все</option>
            {requestStatuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Ответственный
          <select name="assignee" defaultValue={f.assignee ?? ""} className={control}>
            <option value="">Все</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Причина отказа
          <select name="lossReason" defaultValue={f.lossReason ?? ""} className={control}>
            <option value="">Все</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Оплата
          <select name="payment" defaultValue={f.payment ?? ""} className={control}>
            <option value="">Все</option>
            {paymentStatuses.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <button
            type="submit"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-dark px-4 text-[0.875rem] font-medium text-white hover:bg-ink"
          >
            Показать
          </button>
          <Link
            href="/admin/analitika"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-line-strong px-3 text-[0.875rem] font-medium text-ink hover:border-dark"
          >
            Сбросить
          </Link>
        </div>
      </div>
    </form>
  );
}

function Report({ report, f }: { report: AnalyticsReport; f: AnalyticsFilters }) {
  const { dialogs: d, requests: r } = report;
  const empty = r.total === 0 && (d?.total ?? 0) === 0;
  if (empty) {
    return (
      <p className="mt-6 rounded-[var(--radius-card)] bg-white px-6 py-12 text-center text-muted" data-testid="analytics-empty">
        За выбранный период и с выбранными фильтрами обращений и заявок нет.
      </p>
    );
  }
  const maxFunnel = Math.max(1, ...report.funnel.map((s) => s.count ?? 0));
  return (
    <>
      <Section id="summary" title="Основные показатели">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Card title="Новые диалоги" value={d ? d.total : "—"} hint={d ? "MAX и Telegram, начатые в периоде" : "Для выбранного канала диалогов нет"} testId="metric-dialogs" />
          <Card
            title="Уникальные клиенты в диалогах"
            value={d ? d.uniquePeople : "—"}
            hint="Связанные вручную карточки одного человека считаются один раз"
          />
          <Card title="Заявки" value={r.total} hint={`Из них без диалога: ${r.withoutDialog}`} testId="metric-requests" />
          <Card
            title="Уникальные телефоны в заявках"
            value={r.uniquePhones}
            hint={r.withoutPhone ? `Без телефона: ${r.withoutPhone} — для них клиент не определяется` : "По цифрам номера"}
          />
          <Card title="Квалифицированные лиды" value={report.funnel[1]?.count ?? "—"} hint="См. формулу в воронке" />
          <Card title="Выиграно" value={r.won} testId="metric-won" />
          <Card title="Проиграно" value={r.lost} testId="metric-lost" />
          <Card
            title="Без ответа сейчас"
            value={d ? formatPercent(d.unansweredShare) : "—"}
            hint={d ? `${fraction(d.unansweredShare)} диалогов периода ждут ответа` : undefined}
          />
          <Card
            title="Время до первого ответа оператора"
            value={d ? formatDuration(d.firstReply.medianSeconds) : "—"}
            hint={d ? `Медиана; среднее ${formatDuration(d.firstReply.averageSeconds)}; диалогов с ответом: ${d.firstReply.count}` : undefined}
          />
          <Card
            title="От первого контакта до заявки"
            value={formatDuration(r.contactToRequest.medianSeconds)}
            hint={`Медиана по заявкам из диалогов (${r.contactToRequest.count}); среднее ${formatDuration(r.contactToRequest.averageSeconds)}. Для сайта не определяется`}
          />
        </dl>
      </Section>

      <Section
        id="funnel"
        title="Воронка"
        note="Этапы 1–2 — по диалогам, начатым в периоде, и заявкам без диалога; этапы 3–7 — по заявкам, созданным в периоде. «Дошла до этапа» — заявка сейчас на этом этапе или дальше либо была на нём по истории изменений."
      >
        <ol className="space-y-2">
          {report.funnel.map((step, index) => (
            <li key={step.key} className="rounded-[var(--radius-card)] bg-white px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[0.9375rem] font-medium text-ink">
                  {index + 1}. {step.label}
                </span>
                <span className="text-[0.9375rem] text-ink tabular-nums" data-testid={`funnel-${step.key}`}>
                  {step.count ?? "—"}
                  {step.fromPrevious ? (
                    <span className="ml-2 text-[0.8125rem] text-muted">
                      {formatPercent(step.fromPrevious)} от предыдущего ({fraction(step.fromPrevious)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-mist">
                <div
                  className={`h-1.5 rounded-full ${step.key === "lost" ? "bg-danger" : "bg-bronze"}`}
                  style={{ width: `${Math.round(((step.count ?? 0) / maxFunnel) * 100)}%` }}
                />
              </div>
              {step.note ? <p className="mt-1.5 text-[0.75rem] text-muted">{step.note}</p> : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section id="conversions" title="Конверсии">
        <ul className="grid gap-3 md:grid-cols-2">
          {report.conversions.map((c) => (
            <li key={c.key} className="rounded-[var(--radius-card)] bg-white px-4 py-3 sm:px-5">
              <p className="text-[0.8125rem] text-muted">{c.label}</p>
              <p className="text-[1.25rem] font-medium text-ink tabular-nums" data-testid={`conversion-${c.key}`}>
                {formatPercent(c.ratio)} <span className="text-[0.8125rem] font-normal text-muted">({fraction(c.ratio)})</span>
              </p>
              <p className="text-[0.75rem] text-muted">{c.formula}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="money"
        title="Выручка"
        note="Оплачено — сумма оплат по заявкам периода со статусом «оплачено частично» или «полностью». По договору — сумма сделок по выигранным заявкам. Средний чек — сумма по договору / число выигранных заявок с указанной суммой. Валюты не суммируются."
      >
        {report.money.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-white px-5 py-6 text-muted">Суммы сделок и оплаты по заявкам периода не указаны.</p>
        ) : (
          <dl className="grid gap-3 md:grid-cols-2">
            {report.money.map((m) => (
              <div key={m.currency} className="rounded-[var(--radius-card)] bg-white px-4 py-3 sm:px-5" data-testid={`money-${m.currency}`}>
                <dt className="text-[0.8125rem] font-medium text-muted">{m.currency}</dt>
                <dd className="mt-1 space-y-1 text-[0.9375rem] text-ink tabular-nums">
                  <p>Оплачено: {formatMoney(m.paid, m.currency)} <span className="text-muted">({m.paidCount} заяв.)</span></p>
                  <p>По договору: {formatMoney(m.contract, m.currency)} <span className="text-muted">({m.contractCount} сдел.)</span></p>
                  <p>Средний чек: {m.averageCheck === null ? "—" : formatMoney(m.averageCheck, m.currency)}</p>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section id="channels" title="По каналам">
        {report.channels.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-white px-5 py-6 text-muted">Нет данных.</p>
        ) : (
          <>
            <ul className="space-y-2 sm:hidden">
              {report.channels.map((c) => (
                <li key={c.channel} className="rounded-[var(--radius-card)] bg-white px-4 py-3 text-[0.875rem]">
                  <p className="font-medium text-ink">{c.label}</p>
                  <p className="mt-1 text-muted">
                    Диалоги: {c.dialogs ?? "—"} · Заявки: {c.requests} · Выиграно: {c.won} · Проиграно: {c.lost}
                  </p>
                  <p className="text-muted">
                    Выигранных среди закрытых: {formatPercent(c.winRate)} · Оплачено: {formatMoney(c.paidRub, "RUB")}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-[var(--radius-card)] bg-white sm:block">
              <table className="w-full text-left text-[0.875rem]">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Канал</th>
                    <th className="px-4 py-3 text-right font-medium">Диалоги</th>
                    <th className="px-4 py-3 text-right font-medium">Заявки</th>
                    <th className="px-4 py-3 text-right font-medium">Выиграно</th>
                    <th className="px-4 py-3 text-right font-medium">Проиграно</th>
                    <th className="px-4 py-3 text-right font-medium">Выигр. среди закрытых</th>
                    <th className="px-4 py-3 text-right font-medium">Оплачено, RUB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.channels.map((c) => (
                    <tr key={c.channel}>
                      <td className="px-4 py-3 text-ink">{c.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.dialogs ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.requests}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.won}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.lost}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPercent(c.winRate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(c.paidRub, "RUB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-2 text-[0.75rem] text-muted">
          WhatsApp и Авито учитываются только по заявкам, зарегистрированным вручную: переписка в этих сервисах в систему не
          поступает. Источник посещения сайта (UTM) виден в карточке заявки и в выгрузке.
        </p>
      </Section>

      <Section id="loss" title="Причины отказа" note="По проигранным заявкам периода.">
        {report.lossReasons.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-white px-5 py-6 text-muted">Проигранных заявок нет.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-white">
            {report.lossReasons.map((row) => (
              <li key={row.title} className="flex items-center justify-between gap-3 px-4 py-3 text-[0.9375rem] sm:px-5">
                <span className="min-w-0 break-words text-ink">{row.title}</span>
                <span className="text-ink tabular-nums">
                  {row.count}
                  <span className="ml-2 text-[0.8125rem] text-muted">{formatPercent({ numerator: row.count, denominator: r.lost, value: r.lost ? row.count / r.lost : null })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {hasRequestOnlyFilters(f) && d ? (
        <p className="mt-6 text-[0.8125rem] text-muted">
          Фильтры по услуге, этапу, статусу, ответственному, причине отказа и оплате применены к заявкам; показатели диалогов
          учитывают только период и канал.
        </p>
      ) : null}
    </>
  );
}

export default async function AnalyticsPage({ searchParams }: Props) {
  await requireAdminPage();
  const f = parseAnalyticsFilters(await searchParams);
  const data = await load(f);
  const search = filtersToSearch(f);

  return (
    <div className="container-page mt-8 pb-12 lg:mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-tight">Аналитика заявок</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Только фактические данные из базы: диалоги, заявки, этапы, суммы и оплаты, которые внесли сотрудники. Время — московское.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/analitika/prichiny"
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-dark"
          >
            <ListChecks aria-hidden="true" className="h-4 w-4" />
            Причины отказа
          </Link>
          <a
            href={`/api/admin/analytics/export?${search}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-dark"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Показатели CSV
          </a>
          <a
            href={`/api/admin/analytics/export?${search}&kind=requests`}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-dark"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Заявки CSV
          </a>
        </div>
      </div>

      {data ? (
        <>
          <FiltersForm f={f} reasons={data.reasons} assignees={data.assignees} />
          <Report report={data.report} f={f} />
        </>
      ) : (
        <div role="alert" className="mt-6 rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h2 className="text-[1.25rem]">База данных недоступна</h2>
          <p className="mt-2 text-muted">Не удалось посчитать показатели. Обновите страницу позже.</p>
        </div>
      )}
    </div>
  );
}
