import { statusLabel } from "./statuses";

/**
 * Выгрузка заявок в CSV для Excel и других табличных редакторов.
 * Кодировка UTF-8 с BOM (кириллица в Excel), разделитель «;» (русская локаль Excel),
 * все значения в кавычках.
 */

type CsvRequest = {
  id: string;
  createdAt: Date;
  status: string;
  name: string;
  phone: string;
  email: string;
  serviceTitle: string;
  message: string;
  notes: string;
  sourcePage: string | null;
};

// Символы, с которых табличный редактор может начать формулу (CSV/формульная инъекция).
const FORMULA_START = /^[=+\-@\t\r＝＋－＠]/;

/** Экранирует значение ячейки: нейтрализует формулы и кавычки. */
export function csvCell(value: string): string {
  // Проверка до нормализации переводов строк: ведущий \r тоже считается опасным.
  const prefix = FORMULA_START.test(value) ? "'" : "";
  const text = prefix + value.replace(/\r\n?/g, "\n");
  return `"${text.replace(/"/g, '""')}"`;
}

const moscowDate = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoscowDateTime(date: Date): string {
  return moscowDate.format(date).replace(",", "");
}

const header = [
  "Дата поступления (МСК)",
  "Статус",
  "Имя",
  "Телефон",
  "Электронная почта",
  "Направление",
  "Текст обращения",
  "Заметки",
  "Страница",
  "ID",
];

export function requestsToCsv(rows: CsvRequest[]): string {
  const lines = [header.map(csvCell).join(";")];
  for (const row of rows) {
    lines.push(
      [
        formatMoscowDateTime(row.createdAt),
        statusLabel(row.status),
        row.name,
        row.phone,
        row.email,
        row.serviceTitle,
        row.message,
        row.notes,
        row.sourcePage ?? "",
        row.id,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
