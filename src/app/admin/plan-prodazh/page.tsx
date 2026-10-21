import type { Metadata } from "next";
import { getService } from "@/config/services";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { requestChannels } from "@/lib/requests/funnel";
import { computeMetrics, emptyPlanInput } from "@/lib/sales-plan/calc";
import { currentPeriod, isPeriod, periodLabel, shiftPeriod } from "@/lib/sales-plan/period";
import { emptyAuto, getAutoFacts, getHistory, getPlans, listDirections } from "@/lib/sales-plan/repository";
import { DirectionsForm } from "@/components/admin/sales-plan/DirectionsForm";
import { RevenueHistory } from "@/components/admin/sales-plan/RevenueHistory";
import { SalesPlanBoard } from "@/components/admin/sales-plan/SalesPlanBoard";

export const metadata: Metadata = { title: "План продаж" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(period: string) {
  try {
    const previous = shiftPeriod(period, -1);
    const [directions, plans, auto, prevPlans, prevAuto, history] = await Promise.all([
      listDirections(),
      getPlans(period),
      getAutoFacts(period),
      getPlans(previous),
      getAutoFacts(previous),
      getHistory(period, 12),
    ]);
    return { directions, plans, auto, prevPlans, prevAuto, history, previous };
  } catch (error) {
    console.error("[admin] failed to load sales plan:", describeDbError(error));
    return null;
  }
}

export default async function SalesPlanPage({ searchParams }: Props) {
  await requireAdminPage();
  const raw = (await searchParams).period;
  const period = isPeriod(raw) ? raw : currentPeriod();
  const data = await load(period);

  if (!data) {
    return (
      <div className="container-page mt-10">
        <div role="alert" className="rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6">
          <h1 className="text-[1.25rem]">База данных недоступна</h1>
          <p className="mt-2 text-muted">Не удалось загрузить план продаж. Обновите страницу позже — ранее сохранённые данные не потеряны.</p>
        </div>
      </div>
    );
  }

  const { directions, plans, auto, prevPlans, prevAuto, history, previous } = data;
  const records = Object.fromEntries(
    Object.entries(plans).map(([id, r]) => [id, { input: r.input, version: r.version, updatedAt: r.updatedAt.toISOString() }]),
  );
  const previousMetrics = Object.fromEntries(
    directions.map((d) => [d.id, computeMetrics(prevPlans[d.id]?.input ?? emptyPlanInput(), prevAuto.byDirection[d.id] ?? emptyAuto())]),
  );
  const channelLabels = Object.fromEntries(requestChannels.map((c) => [c.value, c.label]));

  return (
    <div className="container-page mt-8 lg:mt-10">
      <h1 className="text-[2rem] leading-tight">План продаж</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {periodLabel(period)}. План и факт по направлениям: выручка, продажи, лиды; средний чек, конверсия и отклонения
        считаются автоматически. Факт берётся из заявок CRM («авто») или вводится вручную.
      </p>

      <SalesPlanBoard
        key={period}
        period={period}
        directions={directions.map((d) => ({ id: d.id, title: d.title }))}
        records={records}
        auto={Object.fromEntries(directions.map((d) => [d.id, { ...emptyAuto(), ...(auto.byDirection[d.id] ?? {}) }]))}
        unclassified={auto.unclassified}
        previous={{ period: previous, metrics: previousMetrics }}
        channelLabels={channelLabels}
      />

      <div>
        <RevenueHistory history={history} directions={directions} />

        <details className="mt-8 mb-28 rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
          <summary className="cursor-pointer text-[1rem] font-medium text-ink">Направления</summary>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Названия можно изменить — данные и правила расчёта привязаны к направлению, а не к названию. Старые заявки
            классифицируются вручную в карточке заявки.
          </p>
          <div className="mt-4">
            <DirectionsForm
              directions={directions.map((d) => ({
                id: d.id,
                title: d.title,
                services: d.serviceSlugs.map((s) => getService(s)?.title ?? s).join(", "),
              }))}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
