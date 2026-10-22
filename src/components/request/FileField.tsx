"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Paperclip, X } from "lucide-react";
import { fileAccept, fileHint, fileLimits, formatFileSize, validateFileList } from "@/lib/request-files";

type Selected = { name: string; size: number };

/**
 * Необязательное поле «Прикрепить файлы» для формы заявки. Файлы отправляются вместе с формой
 * (поле name="files"); здесь — выбор, список выбранных файлов и предварительная проверка.
 *
 * Поле состоит из двух частей: кнопки выбора (FileTrigger) и списка с подсказкой и ошибками (FileList).
 * На странице «Контакты» они стоят друг под другом (FileField), во всплывающем окне кнопка вынесена
 * в строку подписи «Опишите задачу», чтобы окно помещалось в экран.
 */
export function useFileSelection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // React очищает поля формы после отправки (form.reset) — список выбранных файлов очищается вместе с ними.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setSelected([]);
      setLocalError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const sync = () => {
    const list = Array.from(inputRef.current?.files ?? []).map((file) => ({ name: file.name, size: file.size }));
    setSelected(list);
    setLocalError(validateFileList(list));
  };

  const remove = (index: number) => {
    const input = inputRef.current;
    if (!input?.files) return;
    try {
      const transfer = new DataTransfer();
      Array.from(input.files).forEach((file, i) => {
        if (i !== index) transfer.items.add(file);
      });
      input.files = transfer.files;
    } catch {
      // Браузер не позволяет изменить список — очищаем выбор целиком.
      input.value = "";
    }
    sync();
  };

  return { inputRef, selected, localError, sync, remove };
}

type Selection = ReturnType<typeof useFileSelection>;

const ids = (id: string) => ({ hint: `${id}-hint`, error: `${id}-error` });

export function FileTrigger({
  id,
  selection,
  error,
  compact = false,
}: {
  id: string;
  selection: Selection;
  error?: string;
  compact?: boolean;
}) {
  const { inputRef, selected, localError, sync } = selection;
  const message = localError ?? error;
  const describedBy = [ids(id).hint, message ? ids(id).error : null].filter(Boolean).join(" ");
  return (
    <>
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        id={id}
        name="files"
        type="file"
        multiple
        accept={fileAccept}
        onChange={sync}
        className="peer sr-only cursor-pointer"
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy}
      />
      {compact ? (
        // Высота строки подписи не меняется: область нажатия расширена отрицательными отступами.
        <label
          htmlFor={id}
          className="-my-1 inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-control)] px-1 py-1 text-[0.8125rem] leading-5 font-medium text-ink underline decoration-bronze underline-offset-4 hover:text-bronze-deep peer-focus-visible:outline-2 peer-focus-visible:outline-dark peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
          {selected.length > 0 ? `Файлы: ${selected.length}` : "Прикрепить файлы"}
          <span className="sr-only">(необязательно)</span>
        </label>
      ) : (
        <label
          htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line-strong bg-white px-4 text-[0.9375rem] font-medium text-ink transition-colors hover:border-dark peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dark peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          <Paperclip aria-hidden="true" className="h-4 w-4" />
          {selected.length > 0 ? "Выбрать другие файлы" : "Прикрепить файлы"}
          <span className="font-normal text-muted">(необязательно)</span>
        </label>
      )}
    </>
  );
}

/**
 * Список выбранных файлов, подсказка и ошибка.
 * reselect — после ошибки на сервере браузер очищает поле: просим выбрать файлы заново.
 */
export function FileList({
  id,
  selection,
  error,
  compact = false,
  reselect = false,
}: {
  id: string;
  selection: Selection;
  error?: string;
  compact?: boolean;
  reselect?: boolean;
}) {
  const { selected, localError, remove } = selection;
  const message = localError ?? error;
  const again = reselect && selected.length === 0 ? " Файлы нужно выбрать заново." : "";
  const hint = compact
    ? `Файлы необязательны: PDF, фото, Word, Excel — до ${fileLimits.count} шт., до ${fileLimits.totalBytes / 1024 / 1024} МБ вместе.`
    : fileHint;
  // В окне подсказка видна, только когда с файлами что-то происходит; для экранных дикторов она есть всегда.
  const hintVisible = !compact || selected.length > 0 || Boolean(message) || Boolean(again);

  return (
    <>
      {selected.length > 0 ? (
        <ul className={compact ? "mt-1 space-y-0.5" : "mt-3 space-y-1.5"} aria-label="Выбранные файлы">
          {selected.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className={`flex items-center gap-2 text-ink ${compact ? "text-[0.8125rem]" : "text-[0.9375rem]"}`}
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-muted">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Убрать файл ${file.name}`}
                className="-my-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-mist hover:text-ink"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p
        id={ids(id).hint}
        className={`${hintVisible ? "" : "sr-only "}${compact ? "mt-0.5 text-[0.75rem] leading-snug text-muted" : "mt-2 text-[0.875rem] text-muted"}`}
      >
        {hint}
        {again}
      </p>
      {message ? (
        <p id={ids(id).error} className={`font-medium text-danger ${compact ? "mt-0.5 text-[0.8125rem] leading-snug" : "mt-2 text-[0.875rem]"}`}>
          {message}
        </p>
      ) : null}
    </>
  );
}

/** Поле целиком — для формы на странице «Контакты». */
export function FileField({ id, error, reselect = false }: { id: string; error?: string; reselect?: boolean }) {
  const selection = useFileSelection();
  return (
    <div>
      <FileTrigger id={id} selection={selection} error={error} />
      <FileList id={id} selection={selection} error={error} reselect={reselect} />
    </div>
  );
}
