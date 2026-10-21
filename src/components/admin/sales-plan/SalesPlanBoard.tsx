"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, RotateCcw, Save } from "lucide-react";
import { resetPlanAction, savePlanAction, type PlanSnapshot } from "@/app/admin/plan-prodazh/actions";
import {
  computeMetrics,
  computeTotals,
  DASH,
  emptyPlanInput,
  formatCount,
  formatDeviation,
  formatPercent,
  formatRub,
  parsers,
  type AutoFacts,
  type DirectionMetrics,
  type FactMetric,
  type MetricRow,
  type NumberField,
  type PlanInput,
} from "@/lib/sales-plan/calc";
import { monthNames, periodLabel } from "@/lib/sales-plan/period";

export type BoardDirection = { id: string; title: string };
export type BoardAuto = AutoFacts & { leadsByChannel: Record<string, number>; paidWithoutDate: number; paidNonRub: number };

type Base = { input: PlanInput; version: number | null; updatedAt: string | null };
type Errors = Record<string, Partial<Record<NumberField, string>>>;
type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  | { kind: "invalid" }
  | { kind: "conflict"; conflicts: Record<string, PlanSnapshot | null> };

const metricKeys = ["revenue", "sales", "averageCheck", "leads", "conversion"] as const;
type MetricKey = (typeof metricKeys)[number];

const metricInfo: Record<MetricKey, { label: string; kind: "rub" | "count" | "pp"; plan: string; fact: string; deviation: string }> = {
  revenue: {
    label: "Выручка, ₽",
    kind: "rub",
    plan: "Плановая выручка за месяц — ввод.",
    fact: "Сумма полученных оплат за месяц: автоматически по заявкам CRM или вручную.",
    deviation: "Факт − план. Выполнение = факт / план × 100 %.",
  },
  sales: {
    label: "Продажи, шт.",
    kind: "count",
    plan: "Плановое число продаж — ввод.",
    fact: "Число оплаченных заказов за месяц: автоматически по заявкам CRM или вручную.",
    deviation: "Факт − план.",
  },
  averageCheck: {
    label: "Средний чек, ₽",
    kind: "rub",
    plan: "Плановая выручка / плановые продажи. При нуле или пустых значениях — «—».",
    fact: "Фактическая выручка / фактические продажи. При нуле или пустых значениях — «—».",
    deviation: "Фактический средний чек − плановый.",
  },
  leads: {
    label: "Лиды, шт.",
    kind: "count",
    plan: "Плановое число лидов — ввод.",
    fact: "Уникальные клиенты с заявкой по направлению за месяц: автоматически или вручную.",
    deviation: "Факт − план.",
  },
  conversion: {
    label: "Конверсия в продажу, %",
    kind: "pp",
    plan: "План продаж / план лидов × 100 %.",
    fact: "Факт продаж / факт лидов × 100 %.",
    deviation: "Факт − план, в процентных пунктах (п.п.).",
  },
};

const autoRules: Record<FactMetric, string> = {
  revenue:
    "Сумма поля «Получено» по заявкам этого направления со статусом оплаты «частично» или «полностью», датой поступления в выбранном месяце и валютой RUB.",
  sales: "Число таких оплаченных заявок: одна заявка — один заказ. Заявки и сообщения без оплаты продажами не считаются.",
  leads:
    "Уникальные клиенты, оставившие заявку по направлению в выбранном месяце (по дате создания): карточка мессенджера с учётом связанных, иначе телефон, иначе сама заявка. Несколько сообщений одного клиента — один лид.",
};

const inputFields: Record<"revenue" | "sales" | "leads", { plan: NumberField; fact: NumberField; mode: "decimal" | "numeric" }> = {
  revenue: { plan: "revenuePlan", fact: "revenueFact", mode: "decimal" },
  sales: { plan: "salesPlan", fact: "salesFact", mode: "numeric" },
  leads: { plan: "leadsPlan", fact: "leadsFact", mode: "numeric" },
};

function formatValue(key: MetricKey, value: number | null): string {
  if (key === "revenue") return formatRub(value);
  if (key === "averageCheck") return formatRub(value);
  if (key === "conversion") return formatPercent(value);
  return formatCount(value);
}

const toneClass = (value: number | null) => (value === null || value === 0 ? "text-muted" : value > 0 ? "text-success" : "text-danger");
const same = (a: PlanInput, b: PlanInput) => JSON.stringify(a) === JSON.stringify(b);

function validate(input: PlanInput): Partial<Record<NumberField, string>> {
  const errors: Partial<Record<NumberField, string>> = {};
  for (const field of Object.keys(parsers) as NumberField[]) {
    const parsed = parsers[field](input[field]);
    if (!parsed.ok) errors[field] = parsed.error;
  }
  return errors;
}

/** Кнопка с пояснением (формула, источник) — по наведению и по нажатию, доступна с клавиатуры. */
function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Пояснение: ${label}`}
        aria-expanded={open}
        title={text}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:text-ink"
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span role="tooltip" className="absolute top-7 left-1/2 z-20 w-64 -translate-x-1/2 rounded-[var(--radius-control)] bg-dark px-3 py-2 text-left text-[0.75rem] leading-snug font-normal text-white shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  error,
  mode,
  hint,
}: {
  value: string | null;
  onChange: (v: string) => void;
  label: string;
  error?: string;
  mode: "decimal" | "numeric";
  hint: string;
}) {
  return (
    <span className="block">
      <input
        type="text"
        inputMode={mode}
        autoComplete="off"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={error ?? hint}
        placeholder="—"
        className={`block w-full min-w-[5.5rem] rounded-[8px] border bg-white px-2 py-1.5 text-right text-[0.875rem] text-ink tabular-nums focus:border-dark focus:outline-none ${
          error ? "border-danger" : "border-line-strong"
        }`}
      />
      {error ? <span className="mt-0.5 block text-right text-[0.6875rem] text-danger">{error}</span> : null}
    </span>
  );
}

function AutoValue({ value, rule }: { value: string; rule: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap tabular-nums">
      {value}
      <span className="rounded bg-mist px-1 text-[0.625rem] font-medium tracking-wide text-muted uppercase" title={rule}>
        авто
      </span>
    </span>
  );
}

export function SalesPlanBoard({
  period,
  directions,
  records,
  auto,
  unclassified,
  previous,
  channelLabels,
}: {
  period: string;
  directions: BoardDirection[];
  records: Record<string, PlanSnapshot>;
  auto: Record<string, BoardAuto>;
  unclassified: { leads: number; paid: number };
  previous: { period: string; metrics: Record<string, DirectionMetrics> };
  channelLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [base, setBase] = useState<Record<string, Base>>(() =>
    Object.fromEntries(
      directions.map((d) => {
        const r = records[d.id];
        return [d.id, r ? { input: r.input, version: r.version, updatedAt: r.updatedAt } : { input: emptyPlanInput(), version: null, updatedAt: null }];
      }),
    ),
  );
  const [draft, setDraft] = useState<Record<string, PlanInput>>(() => Object.fromEntries(directions.map((d) => [d.id, base[d.id]!.input])));
  const [view, setView] = useState<string>("overview");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const dirtyIds = directions.filter((d) => !same(draft[d.id]!, base[d.id]!.input)).map((d) => d.id);
  const dirty = dirtyIds.length > 0;
  const errors: Errors = useMemo(() => {
    const result: Errors = {};
    for (const d of directions) {
      const e = { ...validate(draft[d.id]!), ...(serverErrors[d.id] ?? {}) };
      if (Object.keys(e).length) result[d.id] = e;
    }
    return result;
  }, [draft, directions, serverErrors]);
  const hasErrors = Object.keys(errors).length > 0;

  const metrics = useMemo(
    () => Object.fromEntries(directions.map((d) => [d.id, computeMetrics(draft[d.id]!, auto[d.id] ?? null)])) as Record<string, DirectionMetrics>,
    [draft, auto, directions],
  );
  const totals = useMemo(() => computeTotals(directions.map((d) => metrics[d.id]!)), [metrics, directions]);
  const prevTotals = useMemo(() => computeTotals(Object.values(previous.metrics)), [previous]);

  // Защита от потери данных: предупреждение при закрытии вкладки и переходе на другой месяц.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const confirmLeave = useCallback(() => !dirtyRef.current || window.confirm("Есть несохранённые изменения. Перейти без сохранения?"), []);

  const setField = (id: string, field: keyof PlanInput, value: string) => {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id]!, [field]: value.trim() === "" ? null : value } }));
    setServerErrors((prev) => {
      if (!prev[id]?.[field as NumberField]) return prev;
      const next = { ...prev, [id]: { ...prev[id] } };
      delete next[id]![field as NumberField];
      return next;
    });
    if (status.kind === "saved" || status.kind === "invalid") setStatus({ kind: "idle" });
  };
  const setSource = (id: string, metric: FactMetric, source: "auto" | "manual") =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id]!, [`${metric}Source`]: source } }));

  function save(versionOverride?: Record<string, number | null>) {
    if (!dirty || hasErrors) {
      if (hasErrors) setStatus({ kind: "invalid" });
      return;
    }
    const rows = dirtyIds.map((id) => ({ directionId: id, version: versionOverride && id in versionOverride ? versionOverride[id]! : base[id]!.version, input: draft[id]! }));
    setStatus({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await savePlanAction({ period, rows });
        if (result.status === "saved") {
          setBase((prev) => {
            const next = { ...prev };
            for (const [id, r] of Object.entries(result.saved)) next[id] = { input: r.input, version: r.version, updatedAt: r.updatedAt };
            return next;
          });
          setDraft((prev) => {
            const next = { ...prev };
            for (const [id, r] of Object.entries(result.saved)) next[id] = r.input;
            return next;
          });
          setServerErrors({});
          setStatus({ kind: "saved", at: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) });
          router.refresh();
        } else if (result.status === "invalid") {
          setServerErrors(result.errors);
          setStatus({ kind: "invalid" });
        } else if (result.status === "conflict") {
          setStatus({ kind: "conflict", conflicts: result.conflicts });
        } else {
          setStatus({ kind: "error", message: result.message });
        }
      } catch {
        setStatus({ kind: "error", message: "Нет связи с сервером. Значения остались на странице — проверьте соединение и повторите." });
      }
    });
  }

  function loadServerVersion(conflicts: Record<string, PlanSnapshot | null>) {
    const next = { ...base };
    const nextDraft = { ...draft };
    for (const [id, r] of Object.entries(conflicts)) {
      next[id] = r ? { input: r.input, version: r.version, updatedAt: r.updatedAt } : { input: emptyPlanInput(), version: null, updatedAt: null };
      nextDraft[id] = next[id]!.input;
    }
    setBase(next);
    setDraft(nextDraft);
    setStatus({ kind: "idle" });
  }

  function overwrite(conflicts: Record<string, PlanSnapshot | null>) {
    const versions: Record<string, number | null> = {};
    for (const [id, r] of Object.entries(conflicts)) versions[id] = r ? r.version : null;
    setBase((prev) => {
      const next = { ...prev };
      for (const [id, v] of Object.entries(versions)) next[id] = { ...next[id]!, version: v };
      return next;
    });
    save(versions);
  }

  function reset(id: string) {
    const title = directions.find((d) => d.id === id)?.title ?? "";
    if (!window.confirm(`Очистить все значения направления «${title}» за ${periodLabel(period).toLowerCase()}? Плановые и ручные фактические значения будут удалены.`)) return;
    const current = base[id]!;
    if (current.version === null) {
      setDraft((prev) => ({ ...prev, [id]: emptyPlanInput() }));
      return;
    }
    setStatus({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await resetPlanAction({ period, directionId: id, version: current.version! });
        if (result.status === "deleted") {
          setBase((prev) => ({ ...prev, [id]: { input: emptyPlanInput(), version: null, updatedAt: null } }));
          setDraft((prev) => ({ ...prev, [id]: emptyPlanInput() }));
          setStatus({ kind: "saved", at: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) });
          router.refresh();
        } else if (result.status === "conflict") {
          setStatus({ kind: "error", message: "Значения изменены в другом окне. Обновите страницу и повторите сброс." });
        } else {
          setStatus({ kind: "error", message: result.message });
        }
      } catch {
        setStatus({ kind: "error", message: "Нет связи с сервером. Повторите попытку." });
      }
    });
  }

  // --- Ячейки ---

  function planCell(id: string, key: MetricKey, title: string) {
    const m = metrics[id]![key];
    if (key === "revenue" || key === "sales" || key === "leads") {
      const f = inputFields[key];
      return (
        <NumberInput
          value={draft[id]![f.plan]}
          onChange={(v) => setField(id, f.plan, v)}
          label={`${title}: ${metricInfo[key].label} — план`}
          error={errors[id]?.[f.plan]}
          mode={f.mode}
          hint={metricInfo[key].plan}
        />
      );
    }
    return <Computed value={formatValue(key, m.plan)} />;
  }

  function factCell(id: string, key: MetricKey, title: string) {
    const m = metrics[id]![key];
    if (key === "revenue" || key === "sales" || key === "leads") {
      const f = inputFields[key];
      if (draft[id]![`${key}Source`] === "auto") return <AutoValue value={formatValue(key, m.fact)} rule={autoRules[key]} />;
      return (
        <NumberInput
          value={draft[id]![f.fact]}
          onChange={(v) => setField(id, f.fact, v)}
          label={`${title}: ${metricInfo[key].label} — факт (вручную)`}
          error={errors[id]?.[f.fact]}
          mode={f.mode}
          hint="Ручной ввод факта. Пусто — не заполнено (не ноль)."
        />
      );
    }
    return <Computed value={formatValue(key, m.fact)} />;
  }

  const deviationText = (key: MetricKey, row: MetricRow) => formatDeviation(row.deviation, metricInfo[key].kind);

  // --- Разметка ---

  const navLink = (to: string, children: ReactNode, label?: string) => (
    <Link
      href={`/admin/plan-prodazh?period=${to}`}
      aria-label={label}
      onClick={(e) => {
        if (!confirmLeave()) e.preventDefault();
      }}
      className="inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-dark"
    >
      {children}
    </Link>
  );

  const [year, month] = [Number(period.slice(0, 4)), Number(period.slice(5, 7))];
  const goTo = (y: number, m: number) => {
    if (!confirmLeave()) return;
    router.push(`/admin/plan-prodazh?period=${y}-${String(m).padStart(2, "0")}`);
  };
  const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 4 + i);
  if (!years.includes(year)) years.push(year);

  return (
    <div>
      {/* Период */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {navLink(shift(period, -1), <ChevronLeft aria-hidden="true" className="h-4 w-4" />, "Предыдущий месяц")}
        <label className="sr-only" htmlFor="plan-month">
          Месяц
        </label>
        <select
          id="plan-month"
          value={month}
          onChange={(e) => goTo(year, Number(e.target.value))}
          className="min-h-10 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.9375rem] font-medium text-ink"
        >
          {monthNames.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="plan-year">
          Год
        </label>
        <select
          id="plan-year"
          value={year}
          onChange={(e) => goTo(Number(e.target.value), month)}
          className="min-h-10 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.9375rem] font-medium text-ink"
        >
          {years.sort().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {navLink(shift(period, 1), <ChevronRight aria-hidden="true" className="h-4 w-4" />, "Следующий месяц")}
        {navLink(currentPeriodClient(), "Текущий месяц")}
      </div>

      {/* KPI */}
      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="plan-kpi">
        <Kpi title="Плановая выручка" value={formatRub(totals.revenue.plan)} testId="kpi-revenue-plan" />
        <Kpi
          title="Фактическая выручка"
          value={formatRub(totals.revenue.fact)}
          testId="kpi-revenue-fact"
          note={prevTotals.revenue.fact !== null ? `Пред. месяц: ${formatRub(prevTotals.revenue.fact)}` : undefined}
        />
        <Kpi title="Выполнение по выручке" value={formatPercent(totals.revenue.completion)} testId="kpi-revenue-completion" note="Факт / план × 100 %" />
        <Kpi title="Средний чек (факт)" value={formatRub(totals.averageCheck.fact)} testId="kpi-check" note="Общая выручка / общие продажи" />
        <Kpi title="Продажи: план" value={formatCount(totals.sales.plan)} testId="kpi-sales-plan" />
        <Kpi
          title="Продажи: факт"
          value={formatCount(totals.sales.fact)}
          testId="kpi-sales-fact"
          note={prevTotals.sales.fact !== null ? `Пред. месяц: ${formatCount(prevTotals.sales.fact)}` : undefined}
        />
        <Kpi
          title="Лиды: факт"
          value={formatCount(totals.leads.fact)}
          testId="kpi-leads-fact"
          note={prevTotals.leads.fact !== null ? `Пред. месяц: ${formatCount(prevTotals.leads.fact)}` : undefined}
        />
        <Kpi title="Конверсия (факт)" value={formatPercent(totals.conversion.fact)} testId="kpi-conversion" note="Все продажи / все лиды × 100 %" />
      </dl>

      {unclassified.leads + unclassified.paid > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-white px-4 py-3 text-[0.875rem] text-ink">
          <span>
            Без направления за месяц: заявок — {unclassified.leads}, оплат — {unclassified.paid}. В автоматические факты они не входят.
          </span>
          <Link href="/admin?direction=none" className="font-medium text-bronze-deep underline underline-offset-2">
            Классифицировать
          </Link>
        </p>
      ) : null}

      {/* Представления */}
      <div role="tablist" aria-label="Представление" className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[{ id: "overview", title: "Обзор" }, ...directions].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line-strong bg-white px-4 text-[0.875rem] font-medium whitespace-nowrap text-ink aria-selected:border-dark aria-selected:bg-dark aria-selected:text-white"
          >
            {tab.title}
            {tab.id !== "overview" && dirtyIds.includes(tab.id) ? <span aria-label="есть изменения" className="ml-1.5 h-1.5 w-1.5 rounded-full bg-bronze" /> : null}
          </button>
        ))}
      </div>

      {view === "overview" ? (
        <section aria-label="Обзор по направлениям" className="mt-4">
          <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white">
            <table className="w-full min-w-[900px] border-collapse text-[0.875rem]">
              <thead>
                <tr className="border-b border-line">
                  <th rowSpan={2} className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-muted">
                    Показатель
                  </th>
                  {directions.map((d) => (
                    <th key={d.id} colSpan={3} className="border-l border-line px-3 py-2 text-center font-medium text-ink">
                      {d.title}
                    </th>
                  ))}
                  <th colSpan={3} className="border-l border-line bg-mist/60 px-3 py-2 text-center font-medium text-ink">
                    Итого
                  </th>
                </tr>
                <tr className="border-b border-line text-[0.75rem] text-muted">
                  {[...directions, { id: "total" }].map((d) => (
                    <SubHeaders key={d.id} shaded={d.id === "total"} />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metricKeys.map((key) => (
                  <tr key={key}>
                    <th scope="row" className="sticky left-0 z-10 w-32 bg-white px-3 py-2 text-left font-medium text-ink sm:w-auto sm:whitespace-nowrap">
                      {metricInfo[key].label}
                      <InfoTip label={metricInfo[key].label} text={`План: ${metricInfo[key].plan} Факт: ${metricInfo[key].fact} Отклонение: ${metricInfo[key].deviation}`} />
                    </th>
                    {directions.map((d) => (
                      <Triple
                        key={d.id}
                        plan={planCell(d.id, key, d.title)}
                        fact={factCell(d.id, key, d.title)}
                        deviation={deviationText(key, metrics[d.id]![key])}
                        tone={toneClass(metrics[d.id]![key].deviation)}
                      />
                    ))}
                    <Triple
                      shaded
                      plan={<Computed value={formatValue(key, totals[key].plan)} />}
                      fact={<Computed value={formatValue(key, totals[key].fact)} />}
                      deviation={deviationText(key, totals[key])}
                      tone={toneClass(totals[key].deviation)}
                    />
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="sticky left-0 z-10 w-32 bg-white px-3 py-2 text-left font-medium text-ink sm:w-auto sm:whitespace-nowrap">
                    Выполнение по выручке
                  </th>
                  {[...directions.map((d) => metrics[d.id]!), totals].map((m, i) => (
                    <td key={i} colSpan={3} className={`border-l border-line px-3 py-2 ${i === directions.length ? "bg-mist/40" : ""}`}>
                      <Progress value={m.revenue.completion} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.75rem] text-muted">
            Белые поля — ввод; «авто» — значение из заявок CRM (источник меняется во вкладке направления); остальное вычисляется. Пустое поле — «не
            заполнено», а не ноль.
          </p>
          <Leaders directions={directions} metrics={metrics} />
          <Comparison directions={directions} metrics={metrics} previous={previous} />
        </section>
      ) : (
        <DirectionDetail
          key={view}
          direction={directions.find((d) => d.id === view)!}
          metrics={metrics[view]!}
          draft={draft[view]!}
          auto={auto[view] ?? null}
          channelLabels={channelLabels}
          planCell={(key) => planCell(view, key, directions.find((d) => d.id === view)!.title)}
          factCell={(key) => factCell(view, key, directions.find((d) => d.id === view)!.title)}
          deviationText={deviationText}
          onSource={(metric, source) => setSource(view, metric, source)}
          onReset={() => reset(view)}
          resetDisabled={pending}
          updatedAt={base[view]!.updatedAt}
        />
      )}

      {/* Панель сохранения — когда есть что сохранить или есть результат последнего действия */}
      <div hidden={!dirty && status.kind === "idle"} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <div role="status" aria-live="polite" className="min-w-0 flex-1 text-[0.875rem]" data-testid="plan-save-status">
            <StatusText status={status} dirty={dirty} hasErrors={hasErrors} onRetry={() => save()} onLoad={loadServerVersion} onOverwrite={overwrite} directions={directions} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={() => {
                if (window.confirm("Отменить несохранённые изменения?")) {
                  setDraft(Object.fromEntries(directions.map((d) => [d.id, base[d.id]!.input])));
                  setServerErrors({});
                  setStatus({ kind: "idle" });
                }
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-4 text-[0.875rem] font-medium text-ink hover:border-dark disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Отменить</span>
            </button>
            <button
              type="button"
              disabled={!dirty || pending || hasErrors}
              onClick={() => save()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-dark px-5 text-[0.875rem] font-medium text-white hover:bg-dark-800 disabled:opacity-50"
            >
              {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function shift(period: string, months: number): string {
  const d = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function currentPeriodClient(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

function Kpi({ title, value, note, testId }: { title: string; value: string; note?: string; testId: string }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] bg-white px-4 py-3">
      <dt className="text-[0.75rem] text-muted">{title}</dt>
      <dd className="mt-0.5 text-[1.25rem] leading-tight font-medium break-words text-ink tabular-nums" data-testid={testId}>
        {value}
      </dd>
      {note ? <dd className="mt-0.5 text-[0.6875rem] text-muted">{note}</dd> : null}
    </div>
  );
}

function SubHeaders({ shaded }: { shaded?: boolean }) {
  const cls = `px-3 py-1.5 text-right font-medium ${shaded ? "bg-mist/60" : ""}`;
  return (
    <>
      <th className={`border-l border-line ${cls}`}>План</th>
      <th className={cls}>Факт</th>
      <th className={cls}>Откл.</th>
    </>
  );
}

function Triple({ plan, fact, deviation, tone, shaded }: { plan: ReactNode; fact: ReactNode; deviation: string; tone: string; shaded?: boolean }) {
  const cls = `px-2 py-1.5 text-right align-top ${shaded ? "bg-mist/40" : ""}`;
  return (
    <>
      <td className={`border-l border-line ${cls}`}>{plan}</td>
      <td className={cls}>{fact}</td>
      <td className={`${cls} font-medium whitespace-nowrap tabular-nums ${tone}`}>{deviation}</td>
    </>
  );
}

function Computed({ value }: { value: string }) {
  return <span className="block px-2 py-1.5 whitespace-nowrap text-muted tabular-nums">{value}</span>;
}

function Progress({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">{DASH}</span>;
  const width = Math.max(0, Math.min(100, value));
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-mist">
        <span className={`block h-1.5 rounded-full ${value >= 100 ? "bg-success" : "bg-bronze"}`} style={{ width: `${width}%` }} />
      </span>
      <span className="w-16 text-right text-[0.8125rem] font-medium text-ink tabular-nums">{formatPercent(value)}</span>
    </span>
  );
}

function StatusText({
  status,
  dirty,
  hasErrors,
  onRetry,
  onLoad,
  onOverwrite,
  directions,
}: {
  status: Status;
  dirty: boolean;
  hasErrors: boolean;
  onRetry: () => void;
  onLoad: (c: Record<string, PlanSnapshot | null>) => void;
  onOverwrite: (c: Record<string, PlanSnapshot | null>) => void;
  directions: BoardDirection[];
}) {
  if (status.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-2 text-muted">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Сохранение…
      </span>
    );
  }
  if (status.kind === "error") {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-danger">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" /> {status.message}
        </span>
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Повторить
        </button>
      </span>
    );
  }
  if (status.kind === "conflict") {
    const names = Object.keys(status.conflicts)
      .map((id) => directions.find((d) => d.id === id)?.title ?? id)
      .join(", ");
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-danger">
        <span>Значения ({names}) изменены в другом окне или другим сотрудником. Ничего не сохранено.</span>
        <button type="button" onClick={() => onLoad(status.conflicts)} className="font-medium underline underline-offset-2">
          Загрузить актуальные
        </button>
        <button type="button" onClick={() => onOverwrite(status.conflicts)} className="font-medium underline underline-offset-2">
          Сохранить мои поверх
        </button>
      </span>
    );
  }
  if (hasErrors) return <span className="text-danger">Исправьте значения, отмеченные красным.</span>;
  if (dirty) return <span className="font-medium text-ink">Есть несохранённые изменения</span>;
  if (status.kind === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Сохранено в {status.at}
      </span>
    );
  }
  return <span className="text-muted">Все изменения сохранены</span>;
}

function Leaders({ directions, metrics }: { directions: BoardDirection[]; metrics: Record<string, DirectionMetrics> }) {
  const withRevenue = directions.filter((d) => (metrics[d.id]!.revenue.fact ?? 0) > 0);
  const top = withRevenue.sort((a, b) => metrics[b.id]!.revenue.fact! - metrics[a.id]!.revenue.fact!)[0];
  const withConversion = directions.filter((d) => metrics[d.id]!.conversion.fact !== null);
  // Конверсии сравниваются, только если они есть хотя бы у двух направлений.
  const best = withConversion.length >= 2 ? withConversion.sort((a, b) => metrics[b.id]!.conversion.fact! - metrics[a.id]!.conversion.fact!)[0] : undefined;
  if (!top && !best) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {top ? (
        <p className="rounded-[var(--radius-card)] bg-white px-4 py-3 text-[0.875rem] text-ink">
          <span className="block text-[0.75rem] text-muted">Наибольшая выручка</span>
          {top.title} — {formatRub(metrics[top.id]!.revenue.fact)}
        </p>
      ) : null}
      {best ? (
        <p className="rounded-[var(--radius-card)] bg-white px-4 py-3 text-[0.875rem] text-ink">
          <span className="block text-[0.75rem] text-muted">Лучшая конверсия</span>
          {best.title} — {formatPercent(metrics[best.id]!.conversion.fact)}
        </p>
      ) : null}
    </div>
  );
}

function Comparison({
  directions,
  metrics,
  previous,
}: {
  directions: BoardDirection[];
  metrics: Record<string, DirectionMetrics>;
  previous: { period: string; metrics: Record<string, DirectionMetrics> };
}) {
  // Нули автоматического подсчёта за пустой месяц — не повод для сравнения.
  const hasPrev = directions.some((d) => {
    const p = previous.metrics[d.id];
    return p && [p.revenue.fact, p.sales.fact, p.leads.fact, p.revenue.plan].some((v) => v !== null && v > 0);
  });
  return (
    <section aria-labelledby="plan-compare" className="mt-8">
      <h2 id="plan-compare" className="text-[1.125rem]">
        Сравнение с месяцем «{periodLabel(previous.period)}»
      </h2>
      {!hasPrev ? (
        <p className="mt-2 rounded-[var(--radius-card)] bg-white px-4 py-4 text-[0.875rem] text-muted">За предыдущий месяц фактических данных нет.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-[var(--radius-card)] bg-white">
          <table className="w-full min-w-[640px] text-[0.875rem]">
            <thead className="border-b border-line text-[0.75rem] text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Направление</th>
                <th className="px-3 py-2 text-right font-medium">Выручка, факт</th>
                <th className="px-3 py-2 text-right font-medium">Изм.</th>
                <th className="px-3 py-2 text-right font-medium">Продажи</th>
                <th className="px-3 py-2 text-right font-medium">Лиды</th>
                <th className="px-3 py-2 text-right font-medium">Конверсия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {directions.map((d) => {
                const now = metrics[d.id]!;
                const prev = previous.metrics[d.id];
                const delta = now.revenue.fact !== null && prev?.revenue.fact != null ? now.revenue.fact - prev.revenue.fact : null;
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-ink">{d.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatRub(now.revenue.fact)} <span className="text-muted">/ {formatRub(prev?.revenue.fact ?? null)}</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${toneClass(delta)}`}>{formatDeviation(delta, "rub")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCount(now.sales.fact)} <span className="text-muted">/ {formatCount(prev?.sales.fact ?? null)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCount(now.leads.fact)} <span className="text-muted">/ {formatCount(prev?.leads.fact ?? null)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPercent(now.conversion.fact)} <span className="text-muted">/ {formatPercent(prev?.conversion.fact ?? null)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 pb-2 text-[0.75rem] text-muted">Текущий месяц / предыдущий (по сохранённым данным).</p>
        </div>
      )}
    </section>
  );
}

function DirectionDetail({
  direction,
  metrics,
  draft,
  auto,
  channelLabels,
  planCell,
  factCell,
  deviationText,
  onSource,
  onReset,
  resetDisabled,
  updatedAt,
}: {
  direction: BoardDirection;
  metrics: DirectionMetrics;
  draft: PlanInput;
  auto: BoardAuto | null;
  channelLabels: Record<string, string>;
  planCell: (key: MetricKey) => ReactNode;
  factCell: (key: MetricKey) => ReactNode;
  deviationText: (key: MetricKey, row: MetricRow) => string;
  onSource: (metric: FactMetric, source: "auto" | "manual") => void;
  onReset: () => void;
  resetDisabled: boolean;
  updatedAt: string | null;
}) {
  const channels = Object.entries(auto?.leadsByChannel ?? {}).filter(([, n]) => n > 0);
  return (
    <section aria-label={`Направление «${direction.title}»`} className="mt-4 space-y-4">
      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white">
        <table className="w-full min-w-[560px] text-[0.875rem]">
          <thead className="border-b border-line text-[0.75rem] text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Показатель</th>
              <th className="px-3 py-2 text-right font-medium">План</th>
              <th className="px-3 py-2 text-right font-medium">Факт</th>
              <th className="px-3 py-2 text-right font-medium">Отклонение</th>
              <th className="px-3 py-2 text-right font-medium">Выполнение</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {metricKeys.map((key) => (
              <tr key={key}>
                <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap text-ink">
                  {metricInfo[key].label}
                  <InfoTip label={metricInfo[key].label} text={`План: ${metricInfo[key].plan} Факт: ${metricInfo[key].fact} Отклонение: ${metricInfo[key].deviation}`} />
                </th>
                <td className="px-2 py-1.5 text-right align-top">{planCell(key)}</td>
                <td className="px-2 py-1.5 text-right align-top">{factCell(key)}</td>
                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums ${toneClass(metrics[key].deviation)}`}>{deviationText(key, metrics[key])}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-muted tabular-nums">
                  {key === "revenue" || key === "sales" || key === "leads" ? formatPercent(metrics[key].completion) : DASH}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-[var(--radius-card)] bg-white p-4 sm:p-5">
        <h2 className="text-[1rem]">Источник фактических значений</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {(["revenue", "sales", "leads"] as const).map((metric) => {
            const source = draft[`${metric}Source`];
            const autoValue = auto ? (metric === "revenue" ? formatRub(auto.revenue) : formatCount(auto[metric])) : DASH;
            return (
              <fieldset key={metric} className="min-w-0 border-t border-line pt-3">
                <legend className="text-[0.875rem] font-medium text-ink">{metricInfo[metric].label}</legend>
                <div className="mt-2 flex gap-4 text-[0.875rem]">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name={`${direction.id}-${metric}-source`} checked={source === "auto"} onChange={() => onSource(metric, "auto")} />
                    Авто из CRM
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name={`${direction.id}-${metric}-source`} checked={source === "manual"} onChange={() => onSource(metric, "manual")} />
                    Вручную
                  </label>
                </div>
                <p className="mt-2 text-[0.8125rem] text-ink">
                  По заявкам CRM: <span className="font-medium tabular-nums">{autoValue}</span>
                </p>
                <p className="mt-1 text-[0.75rem] leading-snug text-muted">{autoRules[metric]}</p>
                {metric === "leads" && channels.length ? (
                  <p className="mt-1 text-[0.75rem] text-muted">По каналам: {channels.map(([c, n]) => `${channelLabels[c] ?? c} — ${n}`).join(", ")}</p>
                ) : null}
                {metric === "revenue" && auto && (auto.paidWithoutDate > 0 || auto.paidNonRub > 0) ? (
                  <p className="mt-1 text-[0.75rem] text-danger">
                    {auto.paidWithoutDate > 0 ? `Оплачено без даты поступления: ${auto.paidWithoutDate}. ` : ""}
                    {auto.paidNonRub > 0 ? `Оплаты не в рублях: ${auto.paidNonRub} (не входят в выручку).` : ""}
                  </p>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.8125rem] text-muted">
        <span>{updatedAt ? `Последнее сохранение: ${new Date(updatedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}` : "Значения за этот месяц ещё не сохранялись."}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 font-medium text-danger hover:border-danger disabled:opacity-50"
        >
          Очистить значения месяца
        </button>
      </div>
    </section>
  );
}
