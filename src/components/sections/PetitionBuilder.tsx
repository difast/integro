"use client";

import { useId, useMemo, useState } from "react";
import { Copy, Eraser, ExternalLink, FileDown, Printer } from "lucide-react";
import {
  buildPetitionDocument,
  emptyFields,
  petitionToHtmlPage,
  petitionToText,
  proceedingKinds,
  proceedings,
  type PetitionBlock,
  type PetitionFields,
  type ProceedingKind,
} from "@/lib/petition";
import { buttonClass } from "@/components/ui/Button";

type FieldDef = { key: keyof PetitionFields; label: string; hint?: string; multiline?: boolean; rows?: number };

const groups: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Суд и дело",
    fields: [
      { key: "court", label: "Наименование суда" },
      { key: "caseNumber", label: "Номер дела" },
      { key: "participants", label: "Другие участники дела", hint: "Наименования или Ф. И. О. и процессуальный статус", multiline: true, rows: 2 },
    ],
  },
  {
    title: "Заявитель",
    fields: [
      { key: "applicantName", label: "Ф. И. О. или наименование" },
      { key: "applicantContacts", label: "Адрес и контакты", multiline: true, rows: 2 },
    ],
  },
  {
    title: "Обоснование",
    fields: [
      { key: "circumstances", label: "Обстоятельства, требующие специальных знаний", multiline: true, rows: 4 },
      { key: "justification", label: "Почему без экспертизы не обойтись", multiline: true, rows: 3 },
      { key: "expertiseType", label: "Вид экспертизы", hint: "Например: строительно-технической, оценочной" },
      { key: "objectInfo", label: "Объект исследования", multiline: true, rows: 2 },
      { key: "materials", label: "Доступные материалы", multiline: true, rows: 2 },
    ],
  },
  {
    title: "Экспертная организация и вопросы",
    fields: [
      { key: "expertOrganization", label: "Предлагаемая организация или эксперт" },
      { key: "expertDetails", label: "Сведения об экспертах, сроке и стоимости", multiline: true, rows: 3 },
      { key: "questions", label: "Вопросы эксперту", hint: "Каждый вопрос с новой строки", multiline: true, rows: 5 },
      { key: "attachments", label: "Приложения", hint: "Каждое приложение с новой строки", multiline: true, rows: 3 },
    ],
  },
  {
    title: "Подпись",
    fields: [
      { key: "date", label: "Дата" },
      { key: "signatory", label: "Подпись и Ф. И. О.", hint: "Для представителя — реквизиты доверенности" },
    ],
  },
];

/**
 * Предпросмотр на странице: та же раскладка, что в файле Word. В узкой колонке текст
 * выровнен по левому краю (по ширине — в новой вкладке, при печати и в Word).
 */
function PetitionPreview({ blocks }: { blocks: PetitionBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "addressee":
            return (
              <div key={index} className="mb-6 ml-[30%] sm:ml-[45%]">
                {block.lines.map((line, i) => (line ? <p key={i}>{line}</p> : <p key={i} aria-hidden="true" className="h-3" />))}
              </div>
            );
          case "title":
            return (
              <div key={index} className="mb-4 text-center font-bold">
                {block.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            );
          case "paragraph":
            return (
              <p key={index} className="mb-2 indent-8 print:text-justify">
                {block.text}
              </p>
            );
          case "heading":
            return (
              <p key={index} className={`mt-4 mb-2 font-bold ${block.align === "center" ? "text-center" : ""}`}>
                {block.text}
              </p>
            );
          case "list":
            return (
              <div key={index} className="mb-2 print:text-justify">
                {block.items.map((item) => (
                  <p key={item} className={block.nested ? "pl-8" : "indent-8"}>
                    {item}
                  </p>
                ))}
              </div>
            );
          case "signature":
            return (
              <div key={index} className="mt-8 flex justify-between gap-6">
                <span>{block.left}</span>
                <span className="text-right">{block.right}</span>
              </div>
            );
        }
      })}
    </>
  );
}

// Кнопки действий одинаковой высоты, во всю ширину своей ячейки, текст в одну строку.
const actionClass = "min-h-11 w-full gap-2 px-3 text-[0.875rem] whitespace-nowrap";

const controlClass =
  "mt-1.5 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none";

/**
 * Конструктор ходатайства. Работает полностью в браузере: введённые данные не
 * отправляются на сервер и нигде не сохраняются — после закрытия страницы они исчезают.
 */
export function PetitionBuilder() {
  const [kind, setKind] = useState<ProceedingKind>("civil");
  const [fields, setFields] = useState<PetitionFields>(emptyFields);
  const [status, setStatus] = useState("");
  const baseId = useId();
  const proceeding = proceedings[kind];
  const blocks = useMemo(() => buildPetitionDocument(kind, fields), [kind, fields]);
  const text = useMemo(() => petitionToText(blocks), [blocks]);

  const update = (key: keyof PetitionFields, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const changeKind = (next: ProceedingKind) => {
    setKind(next);
    // Статус участника у кодексов разный: сбрасываем, если он не подходит новому виду производства.
    setFields((prev) => (proceedings[next].statuses.includes(prev.applicantStatus) ? prev : { ...prev, applicantStatus: "" }));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Текст скопирован в буфер обмена.");
    } catch {
      // Запасной вариант для браузеров без доступа к буферу обмена.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      setStatus(ok ? "Текст скопирован в буфер обмена." : "Не удалось скопировать. Выделите текст в предпросмотре и скопируйте вручную.");
    }
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadWord = async () => {
    setStatus("Готовим файл…");
    try {
      // Библиотека для Word загружается только по нажатию.
      const { petitionToDocxBlob } = await import("@/lib/petition-docx");
      saveBlob(await petitionToDocxBlob(blocks), "hodataystvo-o-naznachenii-ekspertizy.docx");
      setStatus("Файл Word сохранён.");
    } catch {
      setStatus("Не удалось сформировать файл Word. Скопируйте текст или воспользуйтесь печатью.");
    }
  };

  // Предпросмотр в новой вкладке: страница формируется в браузере, на сервер ничего не уходит.
  const preview = () => {
    const url = URL.createObjectURL(new Blob([petitionToHtmlPage(blocks)], { type: "text/html;charset=utf-8" }));
    const tab = window.open(url, "_blank");
    setStatus(tab ? "Предпросмотр открыт в новой вкладке." : "Браузер заблокировал новую вкладку — разрешите всплывающие окна для сайта.");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const clear = () => {
    setFields(emptyFields);
    setStatus("Поля очищены.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="min-w-0 space-y-6 lg:col-span-6">
        <fieldset className="rounded-[var(--radius-card)] bg-white p-6">
          <legend className="sr-only">Вид судопроизводства</legend>
          <p className="text-[0.9375rem] font-medium text-ink" aria-hidden="true">
            Вид судопроизводства
          </p>
          <div className="mt-3 grid gap-2">
            {proceedingKinds.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border px-3.5 py-3 text-[0.875rem] leading-snug has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-dark ${
                  kind === item ? "border-dark bg-mist text-ink" : "border-line text-body hover:border-line-strong"
                }`}
              >
                <input
                  type="radio"
                  name="proceeding"
                  value={item}
                  checked={kind === item}
                  onChange={() => changeKind(item)}
                  className="h-4 w-4 shrink-0 accent-[var(--color-dark)]"
                />
                {proceedings[item].label}
              </label>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-5 text-[0.875rem] leading-relaxed text-muted" aria-live="polite">
            {proceeding.explanation.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </fieldset>

        {groups.map((group) => (
          <fieldset key={group.title} className="space-y-4 rounded-[var(--radius-card)] bg-white p-6">
            <legend className="sr-only">{group.title}</legend>
            <p className="text-[0.9375rem] font-medium text-ink" aria-hidden="true">
              {group.title}
            </p>
            {group.title === "Заявитель" ? (
              <div>
                <label htmlFor={`${baseId}-status`} className="text-[0.875rem] text-body">
                  Процессуальный статус
                </label>
                <select
                  id={`${baseId}-status`}
                  value={fields.applicantStatus}
                  onChange={(event) => update("applicantStatus", event.target.value)}
                  className={controlClass}
                >
                  <option value="">Выберите статус</option>
                  {proceeding.statuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {group.fields.map((field) => {
              const id = `${baseId}-${field.key}`;
              const hintId = field.hint ? `${id}-hint` : undefined;
              return (
                <div key={field.key}>
                  <label htmlFor={id} className="text-[0.875rem] text-body">
                    {field.label}
                  </label>
                  {field.hint ? (
                    <span id={hintId} className="block text-[0.8125rem] text-muted">
                      {field.hint}
                    </span>
                  ) : null}
                  {field.multiline ? (
                    <textarea
                      id={id}
                      rows={field.rows ?? 3}
                      value={fields[field.key]}
                      onChange={(event) => update(field.key, event.target.value)}
                      aria-describedby={hintId}
                      className={`${controlClass} resize-y`}
                    />
                  ) : (
                    <input
                      id={id}
                      type="text"
                      value={fields[field.key]}
                      onChange={(event) => update(field.key, event.target.value)}
                      aria-describedby={hintId}
                      autoComplete="off"
                      className={controlClass}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className="min-w-0 lg:col-span-6">
        <div className="space-y-4 lg:sticky lg:top-6">
          {/* Ровная сетка: основные действия — в первом ряду, вспомогательные — ниже.
              Когда колонка узкая (lg–xl), кнопки встают по две в ряд. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 lg:grid-cols-2 xl:grid-cols-6">
            <button type="button" onClick={downloadWord} className={buttonClass("primary", `${actionClass} sm:col-span-3 lg:col-span-1 xl:col-span-3`)}>
              <FileDown aria-hidden="true" className="h-4 w-4 shrink-0" />
              Скачать Word
            </button>
            <button type="button" onClick={preview} className={buttonClass("outline", `${actionClass} bg-white sm:col-span-3 lg:col-span-1 xl:col-span-3`)}>
              <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
              Предпросмотр
            </button>
            <button type="button" onClick={copy} className={buttonClass("outline", `${actionClass} bg-white sm:col-span-2 lg:col-span-1 xl:col-span-2`)}>
              <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />
              Копировать
            </button>
            <button type="button" onClick={() => window.print()} className={buttonClass("outline", `${actionClass} bg-white sm:col-span-2 lg:col-span-1 xl:col-span-2`)}>
              <Printer aria-hidden="true" className="h-4 w-4 shrink-0" />
              Печать
            </button>
            <button type="button" onClick={clear} className={buttonClass("outline", `${actionClass} col-span-2 bg-white`)}>
              <Eraser aria-hidden="true" className="h-4 w-4 shrink-0" />
              Очистить
            </button>
          </div>
          <p role="status" className="min-h-5 text-[0.875rem] text-muted">
            {status}
          </p>
          <figure className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            <figcaption className="text-[0.8125rem] font-medium text-muted">
              Предпросмотр · {proceeding.code} · в квадратных скобках — незаполненные поля
            </figcaption>
            <div
              data-testid="petition-text"
              className="print-area mt-4 max-h-[70vh] overflow-auto font-[Times_New_Roman,Times,serif] text-[0.875rem] leading-relaxed text-ink"
            >
              <PetitionPreview blocks={blocks} />
            </div>
          </figure>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            Данные не отправляются на сервер и не сохраняются: после закрытия страницы поля очищаются. Скачайте файл
            Word, чтобы продолжить работу в текстовом редакторе.
          </p>
        </div>
      </div>
    </div>
  );
}
