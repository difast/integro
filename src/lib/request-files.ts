/**
 * Файлы к заявке — общие правила для браузера и сервера. Прикреплять файлы необязательно.
 *
 * Тип файла определяется по расширению и на сервере дополнительно сверяется с содержимым
 * (сигнатурой) — см. src/lib/requests/files.ts. Исполняемые файлы, архивы, HTML и SVG не принимаются.
 */

export const fileLimits = {
  count: 5,
  fileBytes: 10 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  nameLength: 150,
} as const;

/** Допустимые расширения и сигнатура содержимого, с которой файл должен совпасть. */
export const allowedFileTypes = {
  pdf: { mime: "application/pdf", kind: "pdf" },
  jpg: { mime: "image/jpeg", kind: "jpeg" },
  jpeg: { mime: "image/jpeg", kind: "jpeg" },
  png: { mime: "image/png", kind: "png" },
  webp: { mime: "image/webp", kind: "webp" },
  heic: { mime: "image/heic", kind: "heif" },
  heif: { mime: "image/heif", kind: "heif" },
  doc: { mime: "application/msword", kind: "ole" },
  xls: { mime: "application/vnd.ms-excel", kind: "ole" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "zip" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "zip" },
  odt: { mime: "application/vnd.oasis.opendocument.text", kind: "zip" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", kind: "zip" },
  rtf: { mime: "application/rtf", kind: "rtf" },
  txt: { mime: "text/plain", kind: "text" },
} as const;

export type AllowedExtension = keyof typeof allowedFileTypes;

/** Значение атрибута accept для поля выбора файлов. */
export const fileAccept = Object.keys(allowedFileTypes).map((ext) => `.${ext}`).join(",");

/** Подсказка под полем. */
export const fileHint = `До ${fileLimits.count} файлов, каждый до ${fileLimits.fileBytes / 1024 / 1024} МБ, вместе до ${
  fileLimits.totalBytes / 1024 / 1024
} МБ: PDF, фото (JPG, PNG, HEIC), документы Word и Excel.`;

export function fileExtension(name: string): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return match ? match[1]!.toLowerCase() : "";
}

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return Object.prototype.hasOwnProperty.call(allowedFileTypes, ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

/**
 * Проверка списка файлов по имени и размеру — одинаковая в браузере и на сервере.
 * Пустой список допустим. Возвращает текст ошибки или null.
 */
export function validateFileList(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return null;
  if (files.length > fileLimits.count) return `Можно прикрепить не более ${fileLimits.count} файлов`;
  for (const file of files) {
    if (!isAllowedExtension(fileExtension(file.name))) {
      return `Файл «${shortName(file.name)}» — неподдерживаемый формат. Подойдут PDF, фото, документы Word и Excel`;
    }
    if (file.size === 0) return `Файл «${shortName(file.name)}» пустой`;
    if (file.size > fileLimits.fileBytes) {
      return `Файл «${shortName(file.name)}» больше ${fileLimits.fileBytes / 1024 / 1024} МБ`;
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > fileLimits.totalBytes) return `Общий размер файлов больше ${fileLimits.totalBytes / 1024 / 1024} МБ`;
  return null;
}

function shortName(name: string): string {
  return name.length > 40 ? `${name.slice(0, 37)}…` : name;
}
