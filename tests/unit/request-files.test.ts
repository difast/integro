import { describe, expect, it } from "vitest";
import { fileExtension, fileLimits, formatFileSize, validateFileList } from "@/lib/request-files";
import { matchesKind, prepareUploads, sanitizeFileName } from "@/lib/requests/files";

const MB = 1024 * 1024;
const pdf = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const file = (data: Buffer | string, name: string) => new File([typeof data === "string" ? data : new Uint8Array(data)], name);

describe("validateFileList", () => {
  it("пустой список допустим — файлы необязательны", () => {
    expect(validateFileList([])).toBeNull();
  });

  it("принимает разрешённые форматы в пределах лимитов", () => {
    expect(validateFileList([{ name: "акт.pdf", size: MB }, { name: "IMG_0001.HEIC", size: 3 * MB }, { name: "смета.xlsx", size: 1000 }])).toBeNull();
  });

  it("отклоняет неподдерживаемые форматы, включая опасные", () => {
    for (const name of ["setup.exe", "page.html", "logo.svg", "archive.zip", "script.js", "без расширения"]) {
      expect(validateFileList([{ name, size: 10 }]), name).toMatch(/неподдерживаемый формат/);
    }
  });

  it("проверяет число, размер каждого файла, общий размер и пустые файлы", () => {
    const six = Array.from({ length: fileLimits.count + 1 }, (_, i) => ({ name: `${i}.pdf`, size: 10 }));
    expect(validateFileList(six)).toMatch(/не более 5 файлов/);
    expect(validateFileList([{ name: "big.pdf", size: fileLimits.fileBytes + 1 }])).toMatch(/больше 10 МБ/);
    expect(validateFileList([{ name: "big.pdf", size: fileLimits.fileBytes }])).toBeNull();
    expect(validateFileList([1, 2, 3].map((i) => ({ name: `${i}.pdf`, size: 7 * MB })))).toMatch(/Общий размер/);
    expect(validateFileList([{ name: "empty.pdf", size: 0 }])).toMatch(/пустой/);
  });
});

describe("вспомогательные функции", () => {
  it("fileExtension и formatFileSize", () => {
    expect(fileExtension("Договор.v2.DOCX")).toBe("docx");
    expect(fileExtension("README")).toBe("");
    expect(formatFileSize(512)).toBe("512 Б");
    expect(formatFileSize(2048)).toBe("2 КБ");
    expect(formatFileSize(1.5 * MB)).toBe("1,5 МБ");
  });

  it("sanitizeFileName убирает путь и управляющие символы, сохраняет расширение у длинных имён", () => {
    expect(sanitizeFileName("C:\\Users\\Иван\\акт осмотра.pdf")).toBe("акт осмотра.pdf");
    expect(sanitizeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFileName('a"b<c>\u0007d.pdf')).toBe("a_b_c__d.pdf");
    const long = sanitizeFileName(`${"я".repeat(300)}.pdf`);
    expect(long.length).toBe(fileLimits.nameLength);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("matchesKind — сверка содержимого с форматом", () => {
  it("распознаёт настоящие сигнатуры", () => {
    expect(matchesKind(pdf, "pdf")).toBe(true);
    expect(matchesKind(jpeg, "jpeg")).toBe(true);
    expect(matchesKind(png, "png")).toBe(true);
    expect(matchesKind(zip, "zip")).toBe(true);
    expect(matchesKind(ole, "ole")).toBe(true);
    expect(matchesKind(heic, "heif")).toBe(true);
    expect(matchesKind(webp, "webp")).toBe(true);
    expect(matchesKind(Buffer.from("{\\rtf1\\ansi"), "rtf")).toBe(true);
    expect(matchesKind(Buffer.from("Простой текст"), "text")).toBe(true);
  });

  it("отклоняет подмену формата", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    expect(matchesKind(exe, "pdf")).toBe(false);
    expect(matchesKind(Buffer.from("<html><script>alert(1)</script>"), "jpeg")).toBe(false);
    expect(matchesKind(Buffer.from([0x41, 0x00, 0x42]), "text")).toBe(false);
    expect(matchesKind(pdf, "zip")).toBe(false);
  });
});

describe("prepareUploads", () => {
  it("без файлов (пустое поле формы) возвращает пустой список", async () => {
    const empty = new File([], "");
    await expect(prepareUploads([empty, "строка"])).resolves.toEqual({ files: [] });
  });

  it("читает файлы, задаёт тип по расширению и считает SHA-256", async () => {
    const result = await prepareUploads([file(pdf, "акт.pdf"), file(jpeg, "фото.JPG")]);
    expect("files" in result).toBe(true);
    if (!("files" in result)) return;
    expect(result.files.map((f) => [f.name, f.mime, f.size])).toEqual([
      ["акт.pdf", "application/pdf", pdf.length],
      ["фото.JPG", "image/jpeg", jpeg.length],
    ]);
    expect(result.files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("отклоняет файл, содержимое которого не совпадает с расширением", async () => {
    const result = await prepareUploads([file("<html>не pdf</html>", "договор.pdf")]);
    expect(result).toEqual({ error: expect.stringMatching(/не похож на PDF/) });
  });

  it("отклоняет запрещённые форматы до чтения содержимого", async () => {
    const result = await prepareUploads([file("MZ", "program.exe")]);
    expect(result).toEqual({ error: expect.stringMatching(/неподдерживаемый формат/) });
  });
});
