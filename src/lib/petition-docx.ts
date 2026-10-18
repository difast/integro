import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
} from "docx";
import type { PetitionBlock } from "./petition";

/**
 * Файл Word (.docx) из блоков ходатайства. Формируется в браузере — данные никуда
 * не отправляются. Модуль подключается динамически, только по нажатию кнопки.
 *
 * Оформление: A4, поля 30/15/20/20 мм, Times New Roman 12 пт, интервал 1,5;
 * шапка — блоком справа, заголовок и «ПРОШУ» — по центру, текст — по ширине
 * с абзацным отступом 1,25 см, дата слева и подпись справа на одной строке.
 */
const mm = convertMillimetersToTwip;
const TEXT_WIDTH = mm(210 - 30 - 15);
const FIRST_LINE = mm(12.5);
const LINE = 360; // 1,5 строки

function run(text: string, bold = false) {
  return new TextRun({ text, bold });
}

function toParagraphs(block: PetitionBlock): Paragraph[] {
  switch (block.type) {
    case "addressee":
      // Блок справа: левый отступ на половину ширины текста, текст внутри — по левому краю.
      return block.lines.map(
        (line, index) =>
          new Paragraph({
            children: [run(line)],
            indent: { left: Math.round(TEXT_WIDTH / 2) },
            spacing: { line: 276, after: index === block.lines.length - 1 ? 360 : 0 },
          }),
      );
    case "title":
      return block.lines.map(
        (line, index) =>
          new Paragraph({
            children: [run(line, true)],
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: index === block.lines.length - 1 ? 240 : 0 },
          }),
      );
    case "paragraph":
      return [
        new Paragraph({
          children: [run(block.text)],
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: FIRST_LINE },
          spacing: { line: LINE, after: 120 },
        }),
      ];
    case "heading":
      return [
        new Paragraph({
          children: [run(block.text, true)],
          alignment: block.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: LINE, before: 240, after: 120 },
        }),
      ];
    case "list":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [run(item)],
            alignment: AlignmentType.JUSTIFIED,
            indent: block.nested ? { left: FIRST_LINE } : { firstLine: FIRST_LINE },
            spacing: { line: LINE },
          }),
      );
    case "signature":
      return [
        new Paragraph({
          children: [run(block.left), new TextRun({ children: [new Tab(), block.right] })],
          tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
          spacing: { before: 720 },
        }),
      ];
  }
}

export async function petitionToDocxBlob(blocks: PetitionBlock[]): Promise<Blob> {
  const doc = new Document({
    creator: "intsoftholding.ru",
    title: "Ходатайство о назначении судебной экспертизы",
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: mm(210), height: mm(297) },
            margin: { top: mm(20), right: mm(15), bottom: mm(20), left: mm(30) },
          },
        },
        children: blocks.flatMap(toParagraphs),
      },
    ],
  });
  return Packer.toBlob(doc);
}
