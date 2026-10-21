import { computeMetrics, formatPercent, formatRub, type DirectionMetrics } from "@/lib/sales-plan/calc";
import { periodShortLabel } from "@/lib/sales-plan/period";
import type { HistoryMonth } from "@/lib/sales-plan/repository";

const palette = ["bg-dark", "bg-bronze", "bg-steel"];

/** Динамика фактической выручки по месяцам — только по сохранённым планам и данным CRM, без примерных значений. */
export function RevenueHistory({ history, directions }: { history: HistoryMonth[]; directions: { id: string; title: string }[] }) {
  const months = history.map((m) => {
    const byDir = Object.fromEntries(
      directions.map((d) => [d.id, m.plans[d.id] || m.auto[d.id] ? computeMetrics(m.plans[d.id] ?? defaultInput, m.auto[d.id] ?? null) : null]),
    ) as Record<string, DirectionMetrics | null>;
    const revenue = directions.map((d) => byDir[d.id]?.revenue.fact ?? 0);
    const plan = directions.reduce((s, d) => s + (byDir[d.id]?.revenue.plan ?? 0), 0);
    return { period: m.period, revenue, total: revenue.reduce((a, b) => a + b, 0), plan, byDir };
  });
  const withData = months.filter((m) => m.total > 0 || m.plan > 0);
  const max = Math.max(1, ...months.map((m) => Math.max(m.total, m.plan)));

  return (
    <section aria-labelledby="plan-history" className="mt-10">
      <h2 id="plan-history" className="text-[1.125rem]">
        Динамика фактической выручки за 12 месяцев
      </h2>
      {withData.length === 0 ? (
        <p className="mt-2 rounded-[var(--radius-card)] bg-white px-4 py-4 text-[0.875rem] text-muted">
          Пока нет сохранённых данных о выручке. График появится после ввода плана или фактов либо после оплат в CRM.
        </p>
      ) : (
        <div className="mt-2 rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted">
            {directions.map((d, i) => (
              <li key={d.id} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${palette[i % palette.length]}`} />
                {d.title}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0 w-3 border-t-2 border-dashed border-danger" />
              План
            </li>
          </ul>
          <div className="mt-4 overflow-x-auto">
            <ol className="flex h-48 min-w-[600px] items-end gap-2" aria-label="Фактическая выручка по месяцам">
              {months.map((m) => (
                <li key={m.period} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="relative flex w-full flex-1 items-end justify-center">
                    {m.plan > 0 ? (
                      <span aria-hidden="true" className="absolute inset-x-0 border-t-2 border-dashed border-danger" style={{ bottom: `${(m.plan / max) * 100}%` }} />
                    ) : null}
                    <span className="flex w-full max-w-10 flex-col-reverse" style={{ height: `${(m.total / max) * 100}%` }} title={`${periodShortLabel(m.period)}: ${formatRub(m.total)}`}>
                      {m.revenue.map((value, i) =>
                        value > 0 ? <span key={i} className={palette[i % palette.length]} style={{ height: `${(value / Math.max(m.total, 1)) * 100}%` }} /> : null,
                      )}
                    </span>
                  </span>
                  <span className="text-[0.6875rem] text-muted">{periodShortLabel(m.period)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[0.8125rem]">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Месяц</th>
                  {directions.map((d) => (
                    <th key={d.id} className="px-2 py-1.5 text-right font-medium">
                      {d.title}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right font-medium">Всего</th>
                  <th className="px-2 py-1.5 text-right font-medium">Выполнение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {withData
                  .slice()
                  .reverse()
                  .map((m) => (
                    <tr key={m.period}>
                      <td className="px-2 py-1.5 text-ink">{periodShortLabel(m.period)}</td>
                      {directions.map((d) => (
                        <td key={d.id} className="px-2 py-1.5 text-right tabular-nums">
                          {formatRub(m.byDir[d.id]?.revenue.fact ?? null)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatRub(m.total)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatPercent(m.plan > 0 ? (m.total / m.plan) * 100 : null)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

const defaultInput = {
  revenuePlan: null,
  salesPlan: null,
  leadsPlan: null,
  revenueFact: null,
  salesFact: null,
  leadsFact: null,
  revenueSource: "auto" as const,
  salesSource: "auto" as const,
  leadsSource: "auto" as const,
};
