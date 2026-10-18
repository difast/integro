/**
 * Шаблон ходатайства о назначении судебной экспертизы — отдельно для гражданского,
 * арбитражного и административного судопроизводства. Нормы одного кодекса не
 * подставляются в шаблон другого.
 *
 * Ссылки на нормы проверены по поисковым выдержкам из нескольких правовых систем
 * (октябрь 2026 г.); КонсультантПлюс и pravo.gov.ru из среды разработки недоступны.
 * Подробности — IMPLEMENTATION_REPORT.md.
 */

export type ProceedingKind = "civil" | "arbitration" | "administrative";

export type LawRef = { title: string; href?: string; note: string };

export type Proceeding = {
  kind: ProceedingKind;
  label: string;
  code: string;
  courtPlaceholder: string;
  casePlaceholder: string;
  statuses: string[];
  /** Пояснение, которое показывается после выбора вида производства */
  explanation: string[];
  laws: LawRef[];
  /** Основание в тексте ходатайства */
  basis: string;
  /** Абзац об оплате экспертизы */
  payment: string;
};

export const proceedings: Record<ProceedingKind, Proceeding> = {
  civil: {
    kind: "civil",
    label: "Гражданское судопроизводство",
    code: "ГПК РФ",
    courtPlaceholder: "наименование суда общей юрисдикции",
    casePlaceholder: "номер гражданского дела",
    statuses: ["истец", "ответчик", "третье лицо", "представитель истца", "представитель ответчика"],
    explanation: [
      "Стороны и другие лица, участвующие в деле, вправе представить суду вопросы для эксперта и просить назначить экспертизу в конкретном судебно-экспертном учреждении или поручить её конкретному эксперту. Окончательный круг вопросов определяет суд, отклонение предложенных вопросов суд обязан мотивировать (ст. 79 ГПК РФ).",
      "Содержание определения о назначении экспертизы установлено ст. 80 ГПК РФ.",
      "Денежные суммы, подлежащие выплате экспертам, по общему правилу предварительно вносит сторона, заявившая просьбу о назначении экспертизы; если просьбу заявили обе стороны — в равных частях. Порядок изменён с 2 августа 2024 года — сверьте актуальную редакцию ст. 96 ГПК РФ.",
    ],
    laws: [
      {
        title: "ГПК РФ, статья 79. Назначение экспертизы",
        href: "https://www.consultant.ru/document/cons_doc_LAW_39570/e6ef7afe62977d99d2ba23d5054af993e4d3496e/",
        note: "КонсультантПлюс",
      },
      {
        title: "ГПК РФ, статья 80. Содержание определения суда о назначении экспертизы",
        href: "https://legalacts.ru/kodeks/GPK-RF/razdel-i/glava-6/statja-80/",
        note: "текст кодекса на legalacts.ru",
      },
      {
        title: "ГПК РФ, статья 96 (внесение денежных сумм, подлежащих выплате экспертам)",
        href: "https://rulaws.ru/gpk-rf/Razdel-I/Glava-7/Statya-96/",
        note: "текст кодекса на rulaws.ru; редакция изменена с 02.08.2024",
      },
    ],
    basis: "статьёй 79 Гражданского процессуального кодекса Российской Федерации",
    payment:
      "Обязуюсь внести денежные суммы, подлежащие выплате эксперту, в порядке, предусмотренном статьёй 96 ГПК РФ, в размере и срок, установленные судом.",
  },
  arbitration: {
    kind: "arbitration",
    label: "Арбитражное судопроизводство",
    code: "АПК РФ",
    courtPlaceholder: "наименование арбитражного суда",
    casePlaceholder: "номер дела (например, А00-0000/2026)",
    statuses: ["истец", "ответчик", "третье лицо", "представитель истца", "представитель ответчика"],
    explanation: [
      "Арбитражный суд назначает экспертизу по ходатайству лица, участвующего в деле, или с согласия лиц, участвующих в деле; по своей инициативе — в случаях, предусмотренных законом. Круг и содержание вопросов определяет суд; лица, участвующие в деле, вправе представить вопросы, а отклонение вопросов суд обязан мотивировать (ст. 82 АПК РФ).",
      "Лица, участвующие в деле, вправе ходатайствовать о привлечении в качестве экспертов указанных ими лиц или о проведении экспертизы в конкретном экспертном учреждении (ст. 82 АПК РФ).",
      "Денежные суммы, подлежащие выплате экспертам, вносятся на депозитный счёт арбитражного суда лицом, заявившим ходатайство, в срок, установленный судом (ст. 108 АПК РФ). Практику применения разъясняет постановление Пленума ВАС РФ от 04.04.2014 № 23.",
    ],
    laws: [
      {
        title: "АПК РФ, статья 82. Назначение экспертизы",
        href: "https://base.garant.ru/12127526/c0750873211da98ff5f0e973a879be11/",
        note: "система ГАРАНТ",
      },
      {
        title: "АПК РФ, статья 108. Внесение сторонами денежных сумм, необходимых для оплаты судебных издержек",
        href: "https://legalacts.ru/kodeks/APK-RF/razdel-i/glava-9/statja-108/",
        note: "текст кодекса на legalacts.ru",
      },
      {
        title: "Постановление Пленума ВАС РФ от 04.04.2014 № 23 «О некоторых вопросах практики применения арбитражными судами законодательства об экспертизе»",
        href: "https://www.vsrf.ru/documents/all/17806/",
        note: "сайт Верховного Суда РФ",
      },
    ],
    basis: "статьёй 82 Арбитражного процессуального кодекса Российской Федерации",
    payment:
      "Денежные суммы, подлежащие выплате эксперту, будут внесены на депозитный счёт арбитражного суда в срок, установленный судом (статья 108 АПК РФ).",
  },
  administrative: {
    kind: "administrative",
    label: "Административное судопроизводство",
    code: "КАС РФ",
    courtPlaceholder: "наименование суда",
    casePlaceholder: "номер административного дела",
    statuses: [
      "административный истец",
      "административный ответчик",
      "заинтересованное лицо",
      "представитель административного истца",
      "представитель административного ответчика",
    ],
    explanation: [
      "При возникновении вопросов, требующих специальных знаний, суд назначает экспертизу по ходатайству лица, участвующего в деле, или по своей инициативе в случаях, предусмотренных кодексом. Лица, участвующие в деле, вправе предложить вопросы; окончательный круг вопросов определяет суд (ст. 77 КАС РФ).",
      "Содержание определения о назначении экспертизы установлено ст. 78 КАС РФ.",
      "Порядок предварительного внесения денежных сумм, подлежащих выплате экспертам, установлен ст. 109 КАС РФ — сверьте актуальную редакцию.",
    ],
    laws: [
      {
        title: "КАС РФ, статья 77. Назначение экспертизы",
        href: "https://base.garant.ru/70885220/06f5cbc2c7200d022e7e6140a05065d6/",
        note: "система ГАРАНТ",
      },
      {
        title: "КАС РФ, статья 78 (определение суда о назначении экспертизы)",
        href: "https://rulaws.ru/kas/RAZDEL-I/Glava-6/Statya-78/",
        note: "текст кодекса на rulaws.ru",
      },
      {
        title: "КАС РФ, статья 109 (предварительное внесение денежных сумм, подлежащих выплате экспертам)",
        note: "ссылку на текст статьи проверить не удалось — откройте в КонсультантПлюс или ГАРАНТ",
      },
    ],
    basis: "статьёй 77 Кодекса административного судопроизводства Российской Федерации",
    payment:
      "Денежные суммы, подлежащие выплате эксперту, обязуюсь внести в порядке, предусмотренном статьёй 109 КАС РФ, в размере и срок, установленные судом.",
  },
};

export const proceedingKinds = Object.keys(proceedings) as ProceedingKind[];

export type PetitionFields = {
  court: string;
  caseNumber: string;
  applicantName: string;
  applicantStatus: string;
  applicantContacts: string;
  participants: string;
  circumstances: string;
  justification: string;
  expertiseType: string;
  objectInfo: string;
  materials: string;
  expertOrganization: string;
  expertDetails: string;
  questions: string;
  attachments: string;
  date: string;
  signatory: string;
};

export const emptyFields: PetitionFields = {
  court: "",
  caseNumber: "",
  applicantName: "",
  applicantStatus: "",
  applicantContacts: "",
  participants: "",
  circumstances: "",
  justification: "",
  expertiseType: "",
  objectInfo: "",
  materials: "",
  expertOrganization: "",
  expertDetails: "",
  questions: "",
  attachments: "",
  date: "",
  signatory: "",
};

function value(text: string, placeholder: string): string {
  const trimmed = text.trim();
  return trimmed ? trimmed : `[${placeholder}]`;
}

/** Нумерованный список из многострочного поля; пустые строки и ручная нумерация отбрасываются. */
function numberedItems(text: string, placeholder: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return (lines.length ? lines : [`[${placeholder}]`]).map((line, index) => `${index + 1}. ${line}`);
}

/**
 * Документ как набор блоков с оформлением: шапка — блоком справа, заголовок и «ПРОШУ» —
 * по центру, основной текст — по ширине с абзацным отступом, дата слева и подпись справа.
 * Из этой структуры собираются текст, предпросмотр и файл Word.
 */
export type PetitionBlock =
  | { type: "addressee"; lines: string[] }
  | { type: "title"; lines: string[] }
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; align: "center" | "left" }
  | { type: "list"; items: string[]; nested?: boolean }
  | { type: "signature"; left: string; right: string };

export function buildPetitionDocument(kind: ProceedingKind, fields: PetitionFields): PetitionBlock[] {
  const p = proceedings[kind];
  const status = value(fields.applicantStatus, "процессуальный статус");
  const caseWord = kind === "administrative" ? "административное дело" : kind === "arbitration" ? "дело" : "гражданское дело";
  const caseNumber = value(fields.caseNumber, p.casePlaceholder);
  const expert = value(fields.expertOrganization, "наименование экспертной организации или Ф. И. О. эксперта");

  return [
    {
      type: "addressee",
      lines: [
        `В ${value(fields.court, p.courtPlaceholder)}`,
        "",
        `от: ${value(fields.applicantName, "Ф. И. О. или наименование заявителя")}, ${status}`,
        value(fields.applicantContacts, "адрес, телефон, адрес электронной почты"),
        "",
        `${caseWord[0]!.toUpperCase()}${caseWord.slice(1)} № ${caseNumber}`,
        `Лица, участвующие в деле: ${value(fields.participants, "наименования / Ф. И. О. и процессуальный статус других участников")}`,
      ],
    },
    { type: "title", lines: ["ХОДАТАЙСТВО", "о назначении судебной экспертизы"] },
    { type: "paragraph", text: `В производстве суда находится ${caseWord} № ${caseNumber}.` },
    { type: "paragraph", text: value(fields.circumstances, "обстоятельства дела, для установления которых требуются специальные знания") },
    {
      type: "paragraph",
      text: value(
        fields.justification,
        "обоснование: почему эти обстоятельства имеют значение для дела и почему для их установления необходимы специальные знания",
      ),
    },
    { type: "paragraph", text: `Объект исследования: ${value(fields.objectInfo, "описание объекта, его местонахождение, возможность осмотра")}.` },
    { type: "paragraph", text: `Материалы, которые могут быть предоставлены эксперту: ${value(fields.materials, "перечень документов и материалов")}.` },
    { type: "paragraph", text: `Проведение экспертизы предлагаю поручить: ${expert}.` },
    {
      type: "paragraph",
      text: value(
        fields.expertDetails,
        "сведения об экспертах (образование, специальность, стаж), сроке и стоимости проведения экспертизы — по ответу экспертной организации",
      ),
    },
    { type: "paragraph", text: `На основании изложенного, в соответствии со ${p.basis},` },
    { type: "heading", text: "ПРОШУ:", align: "center" },
    {
      type: "list",
      items: [
        `1. Назначить по делу ${value(fields.expertiseType, "вид экспертизы")} экспертизу.`,
        `2. Поручить проведение экспертизы ${expert}.`,
        "3. Поставить на разрешение эксперта следующие вопросы:",
      ],
    },
    { type: "list", items: numberedItems(fields.questions, "вопрос эксперту"), nested: true },
    { type: "list", items: ["4. Предоставить в распоряжение эксперта материалы дела и объект исследования."] },
    { type: "paragraph", text: p.payment },
    { type: "heading", text: "Приложения:", align: "left" },
    {
      type: "list",
      items: numberedItems(fields.attachments, "письмо экспертной организации о возможности проведения экспертизы, сроке и стоимости"),
    },
    {
      type: "signature",
      left: value(fields.date, "дата"),
      right: value(fields.signatory, "подпись, Ф. И. О.; для представителя — реквизиты доверенности"),
    },
  ];
}

/** Простой текст (для копирования и .txt). */
export function petitionToText(blocks: PetitionBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "addressee" || block.type === "title") parts.push(block.lines.join("\n"));
    else if (block.type === "paragraph" || block.type === "heading") parts.push(block.text);
    else if (block.type === "list") parts.push(block.items.map((item) => (block.nested ? `   ${item}` : item)).join("\n"));
    else parts.push(`${block.left}\n${block.right}`);
  }
  return parts.join("\n\n");
}

/** Текст ходатайства для выбранного вида производства. */
export function buildPetition(kind: ProceedingKind, fields: PetitionFields): string {
  return petitionToText(buildPetitionDocument(kind, fields));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Отдельная HTML-страница для предпросмотра в новой вкладке (A4, шрифт как в документе). */
export function petitionToHtmlPage(blocks: PetitionBlock[]): string {
  const body = blocks
    .map((block) => {
      switch (block.type) {
        case "addressee":
          return `<div class="addressee">${block.lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '<p class="gap"></p>')).join("")}</div>`;
        case "title":
          return `<div class="title">${block.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>`;
        case "paragraph":
          return `<p class="body">${escapeHtml(block.text)}</p>`;
        case "heading":
          return `<p class="heading ${block.align}">${escapeHtml(block.text)}</p>`;
        case "list":
          return `<div class="list${block.nested ? " nested" : ""}">${block.items.map((i) => `<p>${escapeHtml(i)}</p>`).join("")}</div>`;
        case "signature":
          return `<div class="signature"><span>${escapeHtml(block.left)}</span><span>${escapeHtml(block.right)}</span></div>`;
      }
    })
    .join("\n");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Ходатайство о назначении судебной экспертизы — предпросмотр</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e8edf1; font-family: "Times New Roman", Times, serif; color: #000; }
  .toolbar { position: sticky; top: 0; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 12px; background: #263746; color: #fff; font: 14px/1.4 system-ui, sans-serif; }
  .toolbar button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 0; background: #b49a72; color: #1d2b37; cursor: pointer; }
  .page { width: 210mm; max-width: 100%; min-height: 297mm; margin: 24px auto; padding: 20mm 15mm 20mm 30mm; background: #fff; box-shadow: 0 10px 40px -20px rgba(0,0,0,.4); font-size: 12pt; line-height: 1.5; }
  p { margin: 0; }
  .addressee { margin-left: 50%; margin-bottom: 24pt; }
  .addressee .gap { height: 12pt; }
  .title { text-align: center; font-weight: bold; margin-bottom: 12pt; }
  .body { text-align: justify; text-indent: 1.25cm; margin-bottom: 6pt; }
  .heading { font-weight: bold; margin: 12pt 0 6pt; }
  .heading.center { text-align: center; }
  .list { margin-bottom: 6pt; text-align: justify; }
  .list p { text-indent: 1.25cm; }
  .list.nested p { padding-left: 1.25cm; text-indent: 0; }
  .signature { display: flex; justify-content: space-between; gap: 24pt; margin-top: 36pt; }
  .signature span:last-child { text-align: right; }
  @media (max-width: 640px) { .page { padding: 16px; min-height: 0; margin: 0; } .addressee { margin-left: 30%; } }
  @media print { body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; } @page { size: A4; margin: 20mm 15mm 20mm 30mm; } }
</style></head>
<body>
<div class="toolbar"><span>Предпросмотр ходатайства</span><button type="button" onclick="window.print()">Печать</button></div>
<main class="page">
${body}
</main>
</body></html>`;
}

/** Нормы, упомянутые в тексте ходатайства (для проверки, что кодексы не смешиваются). */
export function codesMentioned(text: string): string[] {
  return ["ГПК РФ", "АПК РФ", "КАС РФ", "Гражданского процессуального", "Арбитражного процессуального", "административного судопроизводства"].filter(
    (code) => text.includes(code),
  );
}
