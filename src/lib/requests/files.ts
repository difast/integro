import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { allowedFileTypes, fileExtension, fileLimits, isAllowedExtension, validateFileList } from "@/lib/request-files";
import { isUuid } from "./repository";

/**
 * Файлы, приложенные к заявке с сайта. Хранятся в PostgreSQL (request_files) вместе с заявкой и удаляются
 * вместе с ней. Отдаются только администратору и только на скачивание (Content-Disposition: attachment).
 */

export type PreparedFile = { name: string; mime: string; size: number; sha256: string; data: Buffer };
export type RequestFileInfo = { id: string; name: string; mime: string; size: number; createdAt: Date };

type Kind = (typeof allowedFileTypes)[keyof typeof allowedFileTypes]["kind"];

const startsWith = (data: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => data[offset + i] === b);
const ascii = (data: Buffer, text: string, offset = 0) => data.subarray(offset, offset + text.length).toString("latin1") === text;
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** Совпадает ли содержимое с заявленным форматом (по сигнатуре в начале файла). */
export function matchesKind(data: Buffer, kind: Kind): boolean {
  switch (kind) {
    case "pdf":
      return ascii(data, "%PDF-");
    case "jpeg":
      return startsWith(data, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp":
      return ascii(data, "RIFF") && ascii(data, "WEBP", 8);
    case "heif":
      return ascii(data, "ftyp", 4) && HEIF_BRANDS.has(data.subarray(8, 12).toString("latin1"));
    case "ole":
      return startsWith(data, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "zip":
      return startsWith(data, [0x50, 0x4b, 0x03, 0x04]);
    case "rtf":
      return ascii(data, "{\\rtf");
    case "text":
      // Обычный текст: без нулевых байтов в начале файла.
      return !data.subarray(0, 8192).includes(0);
  }
}

/** Имя файла для хранения и скачивания: без пути и управляющих символов, с сохранённым расширением. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  // Управляющие символы и знаки, недопустимые в именах файлов Windows, заменяются на «_».
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "_").replace(/\s+/g, " ").trim();
  const ext = fileExtension(clean);
  if (clean.length <= fileLimits.nameLength) return clean || `file.${ext || "bin"}`;
  const keep = fileLimits.nameLength - ext.length - 2;
  return `${clean.slice(0, keep)}…${ext ? `.${ext}` : ""}`;
}

/**
 * Читает и проверяет файлы из формы. Пустые поля (браузер присылает «файл» без имени и размера) пропускаются.
 * Ошибка возвращается текстом для пользователя.
 */
export async function prepareUploads(entries: FormDataEntryValue[]): Promise<{ files: PreparedFile[] } | { error: string }> {
  const uploads = entries.filter((entry): entry is File => typeof entry !== "string" && entry.size > 0);
  const listError = validateFileList(uploads.map((file) => ({ name: file.name, size: file.size })));
  if (listError) return { error: listError };

  const files: PreparedFile[] = [];
  for (const upload of uploads) {
    const name = sanitizeFileName(upload.name);
    const ext = fileExtension(name);
    if (!isAllowedExtension(ext)) return { error: "Неподдерживаемый формат файла" };
    const data = Buffer.from(await upload.arrayBuffer());
    const type = allowedFileTypes[ext];
    if (data.length !== upload.size || data.length > fileLimits.fileBytes) return { error: "Не удалось прочитать файл. Попробуйте ещё раз" };
    if (!matchesKind(data, type.kind)) {
      return { error: `Файл «${name}» не похож на ${ext.toUpperCase()}. Проверьте формат файла` };
    }
    files.push({ name, mime: type.mime, size: data.length, sha256: createHash("sha256").update(data).digest("hex"), data });
  }
  return { files };
}

/** Сохраняет файлы в той же транзакции, что и заявку. */
export async function saveRequestFiles(db: PoolClient, requestId: string, files: PreparedFile[]): Promise<void> {
  for (const file of files) {
    await db.query(
      "INSERT INTO request_files (request_id, file_name, mime, size_bytes, sha256, data) VALUES ($1, $2, $3, $4, $5, $6)",
      [requestId, file.name, file.mime, file.size, file.sha256, file.data],
    );
  }
}

export async function listRequestFiles(requestId: string): Promise<RequestFileInfo[]> {
  if (!isUuid(requestId)) return [];
  const rows = await query<{ id: string; file_name: string; mime: string; size_bytes: number; created_at: Date }>(
    "SELECT id, file_name, mime, size_bytes, created_at FROM request_files WHERE request_id = $1 ORDER BY id",
    [requestId],
  );
  return rows.map((r) => ({ id: String(r.id), name: r.file_name, mime: r.mime, size: r.size_bytes, createdAt: r.created_at }));
}

export async function getRequestFile(requestId: string, fileId: string): Promise<(RequestFileInfo & { data: Buffer }) | null> {
  if (!isUuid(requestId) || !/^\d{1,18}$/.test(fileId)) return null;
  const rows = await query<{ id: string; file_name: string; mime: string; size_bytes: number; created_at: Date; data: Buffer }>(
    "SELECT id, file_name, mime, size_bytes, created_at, data FROM request_files WHERE request_id = $1 AND id = $2",
    [requestId, fileId],
  );
  const r = rows[0];
  return r ? { id: String(r.id), name: r.file_name, mime: r.mime, size: r.size_bytes, createdAt: r.created_at, data: r.data } : null;
}
