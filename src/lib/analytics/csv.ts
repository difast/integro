import { describeAttribution, type Attribution } from "@/lib/requests/attribution";
import { csvCell, formatMoscowDateTime } from "@/lib/requests/csv";
import { channelLabel, paymentLabel, stageLabel } from "@/lib/requests/funnel";
import { requestNumberOf } from "@/lib/requests/number";
import { statusLabel } from "@/lib/requests/statuses";
import { formatPercent, type AnalyticsFilters, type Ratio } from "./filters";
import type { AnalyticsReport, AnalyticsRequestRow } from "./repository";

/** CSV аналитики: UTF-8 с BOM, разделитель «;», защита от формульной инъекции (csvCell). */

const line = (cells: (string | number | null)[]) => cells.map((c) => csvCell(c === null ? "" : String(c))).join(";");
const finish = (lines: string[]) => `﻿${lines.join("\r\n")}\r\n`;
const ratioCells = (r: Ratio) => [r.numerator, r.denominator, formatPercent(r)];

export function reportToCsv(report: AnalyticsReport, f: AnalyticsFilters): string {
  const lines = [line(["Показатель", "Значение", "Числитель", "Знаменатель", "Доля", "Пояснение"])];
  lines.push(line(["Период", `${f.from} — ${f.to}`, null, null, null, "Московское время, обе даты включительно"]));
  const d = report.dialogs;
  const r = report.requests;
  if (d) {
    lines.push(line(["Новые диалоги", d.total, null, null, null, "MAX и Telegram, начатые в периоде"]));
    lines.push(line(["Уникальные клиенты в диалогах", d.uniquePeople, null, null, null, "Связанные карточки — один человек"]));
    lines.push(line(["Без ответа сейчас", d.unanswered, ...ratioCells(d.unansweredShare), "Диалоги периода с отметкой «нужен ответ»"]));
    lines.push(line(["Время до первого ответа оператора, медиана, мин", d.firstReply.medianSeconds === null ? null : Math.round(d.firstReply.medianSeconds / 60), null, d.firstReply.count, null, "Диалогов с ответом оператора"]));
  }
  lines.push(line(["Заявки", r.total, null, null, null, `Без диалога: ${r.withoutDialog}`]));
  lines.push(line(["Уникальные телефоны в заявках", r.uniquePhones, null, null, null, `Без телефона: ${r.withoutPhone}`]));
  lines.push(line(["От контакта до заявки, медиана, мин", r.contactToRequest.medianSeconds === null ? null : Math.round(r.contactToRequest.medianSeconds / 60), null, r.contactToRequest.count, null, "Только заявки из диалогов"]));
  for (const step of report.funnel) {
    lines.push(line([`Воронка: ${step.label}`, step.count, ...(step.fromPrevious ? ratioCells(step.fromPrevious) : [null, null, null]), step.note ?? null]));
  }
  for (const c of report.conversions) lines.push(line([`Конверсия: ${c.label}`, null, ...ratioCells(c.ratio), c.formula]));
  for (const m of report.money) {
    lines.push(line([`Оплачено, ${m.currency}`, m.paid.toFixed(2), m.paidCount, null, null, "Заявок с оплатой"]));
    lines.push(line([`По договору, ${m.currency}`, m.contract.toFixed(2), m.contractCount, null, null, "Выигранных заявок с суммой"]));
    lines.push(line([`Средний чек, ${m.currency}`, m.averageCheck === null ? null : m.averageCheck.toFixed(2), m.contract.toFixed(2), m.contractCount, null, "По договору / число сделок"]));
  }
  for (const c of report.channels) {
    lines.push(line([`Канал: ${c.label}`, c.requests, c.won, c.won + c.lost, formatPercent(c.winRate), `Диалоги: ${c.dialogs ?? "—"}; проиграно: ${c.lost}; оплачено RUB: ${c.paidRub.toFixed(2)}`]));
  }
  for (const reason of report.lossReasons) lines.push(line([`Причина отказа: ${reason.title}`, reason.count, reason.count, r.lost, null, null]));
  return finish(lines);
}

export function analyticsRequestsToCsv(rows: AnalyticsRequestRow[]): string {
  const lines = [
    line([
      "Номер",
      "Создана",
      "Канал",
      "Услуга",
      "Статус обработки",
      "Этап",
      "Причина отказа",
      "Ответственный",
      "Сумма сделки",
      "Валюта",
      "Оплата",
      "Оплачено",
      "Дата оплаты",
      "Источник",
      "utm_source",
      "utm_medium",
      "utm_campaign",
    ]),
  ];
  for (const row of rows) {
    const a = row.attribution as Attribution | null;
    lines.push(
      line([
        requestNumberOf(row.id),
        formatMoscowDateTime(row.createdAt),
        channelLabel(row.channel),
        row.serviceTitle,
        statusLabel(row.status),
        stageLabel(row.stage),
        row.lossReason,
        row.assignee,
        row.dealAmount,
        row.currency,
        paymentLabel(row.paymentStatus),
        row.paidAmount,
        row.paidAt,
        row.channel === "site" ? describeAttribution(a) : null,
        a?.utm_source ?? null,
        a?.utm_medium ?? null,
        a?.utm_campaign ?? null,
      ]),
    );
  }
  return finish(lines);
}
