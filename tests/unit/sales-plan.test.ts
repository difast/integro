import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  computeTotals,
  emptyPlanInput,
  formatCount,
  formatDeviation,
  formatPercent,
  formatRub,
  parseCountValue,
  parseMoneyValue,
  toInputValue,
  type PlanInput,
} from "@/lib/sales-plan/calc";
import { currentPeriod, isPeriod, periodLabel, shiftPeriod } from "@/lib/sales-plan/period";

const manual = (patch: Partial<PlanInput>): PlanInput => ({ ...emptyPlanInput(), revenueSource: "manual", salesSource: "manual", leadsSource: "manual", ...patch });
const strip = (s: string) => s.replace(/ | /g, " ");

describe("план продаж: формулы", () => {
  it("выручка, продажи, средний чек, лиды и конверсия с отклонениями", () => {
    const m = computeMetrics(
      manual({ revenuePlan: "1 000 000", salesPlan: "20", leadsPlan: "100", revenueFact: "1200000", salesFact: "25", leadsFact: "80" }),
      null,
    );
    expect(m.revenue).toEqual({ plan: 1_000_000, fact: 1_200_000, deviation: 200_000, completion: 120 });
    expect(m.sales).toEqual({ plan: 20, fact: 25, deviation: 5, completion: 125 });
    expect(m.averageCheck.plan).toBe(50_000);
    expect(m.averageCheck.fact).toBe(48_000);
    expect(m.averageCheck.deviation).toBe(-2_000);
    expect(m.leads.deviation).toBe(-20);
    expect(m.conversion.plan).toBeCloseTo(20);
    expect(m.conversion.fact).toBeCloseTo(31.25);
    // Отклонение конверсии — в процентных пунктах, не в процентах.
    expect(m.conversion.deviation).toBeCloseTo(11.25);
  });

  it("ноль и пустые значения: деления на ноль нет, пустое не превращается в ноль", () => {
    const empty = computeMetrics(manual({}), null);
    expect(empty.revenue).toEqual({ plan: null, fact: null, deviation: null, completion: null });
    expect(empty.averageCheck.plan).toBeNull();
    expect(empty.conversion.fact).toBeNull();

    const zeros = computeMetrics(manual({ revenuePlan: "0", salesPlan: "0", leadsPlan: "0", revenueFact: "0", salesFact: "0", leadsFact: "0" }), null);
    expect(zeros.revenue.fact).toBe(0);
    expect(zeros.revenue.deviation).toBe(0);
    expect(zeros.revenue.completion).toBeNull(); // план 0 — выполнение не определено
    expect(zeros.averageCheck.fact).toBeNull();
    expect(zeros.conversion.plan).toBeNull();

    const onlyPlan = computeMetrics(manual({ revenuePlan: "500000" }), null);
    expect(onlyPlan.revenue.deviation).toBeNull(); // факт не заполнен — отклонения нет
    expect(onlyPlan.averageCheck.plan).toBeNull(); // продажи не заполнены — средний чек не подставляется
  });

  it("автоматический факт берётся из CRM, ручной — из поля; переключение не теряет ручное значение", () => {
    const input: PlanInput = { ...emptyPlanInput(), revenueFact: "999", salesFact: "9" };
    const auto = { revenue: 150_000, sales: 3, leads: 10 };
    expect(computeMetrics(input, auto).revenue.fact).toBe(150_000);
    expect(computeMetrics(input, auto).conversion.fact).toBeCloseTo(30);
    expect(computeMetrics({ ...input, revenueSource: "manual" }, auto).revenue.fact).toBe(999);
    expect(computeMetrics(input, null).revenue.fact).toBeNull();
  });

  it("итог: суммы по направлениям; конверсия = все продажи / все лиды, а не среднее конверсий", () => {
    const a = computeMetrics(manual({ revenueFact: "100000", salesFact: "1", leadsFact: "10" }), null); // 10 %
    const b = computeMetrics(manual({ revenueFact: "300000", salesFact: "9", leadsFact: "10" }), null); // 90 %
    const c = computeMetrics(manual({}), null);
    const t = computeTotals([a, b, c]);
    expect(t.revenue.fact).toBe(400_000);
    expect(t.sales.fact).toBe(10);
    expect(t.leads.fact).toBe(20);
    expect(t.conversion.fact).toBeCloseTo(50);
    expect(t.averageCheck.fact).toBe(40_000);
    expect(t.revenue.plan).toBeNull();
    // Направление без лидов не искажает итоговую конверсию.
    const d = computeMetrics(manual({ salesFact: "5" }), null);
    expect(computeTotals([a, d]).conversion.fact).toBeCloseTo(10);
  });

  it("проверка ввода: отрицательные, дробные количества и мусор отклоняются", () => {
    expect(parseMoneyValue("1 250 000,50")).toEqual({ ok: true, value: 1_250_000.5 });
    expect(parseMoneyValue("")).toEqual({ ok: true, value: null });
    expect(parseMoneyValue("-5").ok).toBe(false);
    expect(parseMoneyValue("1e6").ok).toBe(false);
    expect(parseCountValue("12")).toEqual({ ok: true, value: 12 });
    expect(parseCountValue("1.5").ok).toBe(false);
    expect(parseCountValue("-1").ok).toBe(false);
    expect(toInputValue("150000.00")).toBe("150000");
    expect(toInputValue("1500.50")).toBe("1500,5");
  });

  it("вывод: рубли с разделителями, целые, проценты с одним знаком, п.п.", () => {
    expect(strip(formatRub(1234567.89))).toBe("1 234 568 ₽");
    expect(strip(formatCount(12000))).toBe("12 000");
    expect(formatPercent(33.333)).toBe("33,3 %");
    expect(formatPercent(null)).toBe("—");
    expect(strip(formatDeviation(-2500, "rub"))).toBe("−2 500 ₽");
    expect(formatDeviation(2.5, "pp")).toBe("+2,5 п.п.");
    expect(formatDeviation(0, "count")).toBe("0");
  });
});

describe("план продаж: период", () => {
  it("месяц по Москве, переходы через год", () => {
    expect(currentPeriod(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(isPeriod("2026-13")).toBe(false);
    expect(isPeriod("26-01")).toBe(false);
    expect(periodLabel("2026-03")).toBe("Март 2026");
  });
});
