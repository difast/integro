/**
 * Помощник «Какой документ мне нужен?» — прозрачные правила без ИИ и внешних сервисов.
 *
 * На входе четыре ответа, на выходе — предварительная рекомендация: отчёт об оценке,
 * заключение специалиста, судебная экспертиза или консультация. Рекомендация не является
 * юридическим заключением и не гарантирует правильный выбор документа.
 */

export type Purpose = "value" | "damage" | "technical" | "court" | "unsure";
export type CaseStatus = "in-court" | "none" | "planning" | "unsure";
export type UserType = "self" | "lawyer" | "court" | "organization" | "unknown";
export type ObjectType = "realty" | "business" | "flood" | "car" | "construction" | "other";

export type Answers = {
  purpose?: Purpose;
  caseStatus?: CaseStatus;
  user?: UserType;
  object?: ObjectType;
};

export type ResultKind = "report" | "specialist" | "court" | "consult";

type Option<T extends string> = { value: T; label: string };

export const purposeOptions: Option<Purpose>[] = [
  { value: "value", label: "Узнать рыночную или иную стоимость объекта" },
  { value: "damage", label: "Подтвердить размер ущерба" },
  { value: "technical", label: "Разобраться в техническом состоянии объекта или качестве работ" },
  { value: "court", label: "Представить доказательства или получить ответы на специальные вопросы в судебном споре" },
  { value: "unsure", label: "Другая задача / пока не уверен" },
];

export const caseOptions: Option<CaseStatus>[] = [
  { value: "in-court", label: "Да, дело уже рассматривается судом" },
  { value: "none", label: "Судебного дела пока нет" },
  { value: "planning", label: "Планирую обращаться в суд, но дело ещё не возбуждено" },
  { value: "unsure", label: "Не уверен, нужно ли обращаться в суд" },
];

export const userOptions: Option<UserType>[] = [
  { value: "self", label: "Я сам или моя организация" },
  { value: "lawyer", label: "Юрист, адвокат или представитель" },
  { value: "court", label: "Суд — документ нужен в рамках судебного дела" },
  { value: "organization", label: "Страховая компания, банк, государственный орган или другая организация" },
  { value: "unknown", label: "Пока не знаю" },
];

const objectLabels: Record<ObjectType, string> = {
  realty: "Квартира или другая недвижимость",
  business: "Бизнес или доля в компании",
  flood: "Ущерб от залива или другого повреждения",
  car: "Автомобиль",
  construction: "Строительство, ремонт или качество работ",
  other: "Другой объект",
};

/** Последний вопрос подстраивается под цель: показываются только подходящие варианты. */
export function objectOptions(purpose: Purpose | undefined): Option<ObjectType>[] {
  const byPurpose: Record<Purpose, ObjectType[]> = {
    value: ["realty", "business", "car", "other"],
    damage: ["flood", "realty", "car", "construction", "other"],
    technical: ["construction", "flood", "realty", "car", "other"],
    court: ["realty", "business", "flood", "car", "construction", "other"],
    unsure: ["realty", "business", "flood", "car", "construction", "other"],
  };
  const list = purpose ? byPurpose[purpose] : byPurpose.unsure;
  return list.map((value) => ({ value, label: objectLabels[value] }));
}

export type Step = {
  key: keyof Answers;
  title: string;
  hint?: string;
  options: (answers: Answers) => Option<string>[];
};

export const steps: Step[] = [
  { key: "purpose", title: "Для чего вам нужен документ?", options: () => purposeOptions },
  { key: "caseStatus", title: "Есть ли уже судебное дело?", options: () => caseOptions },
  { key: "user", title: "Кто будет использовать документ?", options: () => userOptions },
  {
    key: "object",
    title: "Какой объект или ситуация рассматривается?",
    hint: "Варианты подобраны с учётом цели из первого вопроса.",
    options: (answers) => objectOptions(answers.purpose),
  },
];

export type Recommendation = {
  kind: ResultKind;
  /** Код для передачи в форму заявки (контекст обращения) */
  code: string;
  title: string;
  /** Почему подходит — с учётом ответов */
  reasons: string[];
  /** Важные оговорки */
  notes: string[];
  /** Что подготовить */
  prepare: string[];
  /** Страница услуги */
  service: { href: string; label: string } | null;
  /** Ссылка на материалы для юристов */
  lawyers: boolean;
};

export const kindTitles: Record<Exclude<ResultKind, "consult">, string> = {
  report: "Отчёт об оценке",
  specialist: "Заключение специалиста",
  court: "Судебная экспертиза",
};

/** Чем каждый вариант отличается от двух других — показывается на экране результата. */
export const kindExplanations: Record<Exclude<ResultKind, "consult">, string> = {
  report:
    "Определяет стоимость объекта (или размер ущерба в денежном выражении) по правилам оценочной деятельности. Готовится по договору с заказчиком. Важно сразу назвать цель оценки и дату: от них зависит вид стоимости. Отчёт не заменяет судебную экспертизу, хотя может быть представлен в суд как доказательство.",
  specialist:
    "Письменный анализ вопроса, требующего специальных знаний: технические выводы, исследование материалов, профессиональное мнение. Готовится по договору вне процедуры назначения экспертизы судом. Не равнозначно заключению судебного эксперта: суд оценивает его наряду с другими доказательствами.",
  court:
    "Назначается судом определением в рамках рассматриваемого дела. Сторона может заявить ходатайство, предложить вопросы и экспертную организацию, но решение о назначении, круг вопросов и выбор эксперта определяет суд. Организация не назначает экспертизу самостоятельно.",
};

const serviceByObject: Record<ObjectType, { report: string; specialist: string }> = {
  realty: { report: "ocenka-kvartiry", specialist: "stroitelno-tehnicheskaya-ekspertiza" },
  business: { report: "ocenka-biznesa", specialist: "ekspertnye-issledovaniya" },
  flood: { report: "ocenka-ushcherba-ot-zaliva", specialist: "stroitelno-tehnicheskaya-ekspertiza" },
  car: { report: "ocenka-avtomobilya", specialist: "ekspertnye-issledovaniya" },
  construction: { report: "ocenka", specialist: "stroitelno-tehnicheskaya-ekspertiza" },
  other: { report: "ocenka", specialist: "ekspertnye-issledovaniya" },
};

const serviceLabels: Record<string, string> = {
  ocenka: "Оценочная деятельность",
  "ocenka-kvartiry": "Оценка квартиры",
  "ocenka-biznesa": "Оценка бизнеса",
  "ocenka-ushcherba-ot-zaliva": "Оценка ущерба от залива",
  "ocenka-avtomobilya": "Оценка автомобиля",
  "stroitelno-tehnicheskaya-ekspertiza": "Строительно-техническая экспертиза",
  "ekspertnye-issledovaniya": "Экспертные исследования",
  "sudebnaya-ekspertiza": "Судебная экспертиза",
};

function service(slug: string) {
  return { href: `/uslugi/${slug}`, label: serviceLabels[slug] ?? slug };
}

const prepareByObject: Record<ObjectType, string[]> = {
  realty: ["Адрес и основные характеристики объекта", "Документы о праве на объект (выписка ЕГРН или иные)", "Технический или кадастровый паспорт, если есть"],
  business: ["Что оценивается: компания целиком, доля или акции", "Бухгалтерская отчётность за несколько периодов", "Сведения о существенных активах и обязательствах"],
  flood: ["Фото и видео повреждений с датой съёмки", "Акт о заливе, если составлялся", "Перечень повреждённой отделки и имущества"],
  car: ["Марка, модель, год выпуска, VIN, пробег", "ПТС и свидетельство о регистрации", "Сведения о повреждениях и ремонтах"],
  construction: ["Договор подряда, смета, проектная документация", "Акты выполненных работ", "Фото дефектов и переписка с подрядчиком"],
  other: ["Описание объекта и ситуации", "Имеющиеся документы об объекте", "Чего вы хотите добиться с помощью документа"],
};

const purposePhrase: Record<Purpose, string> = {
  value: "вам нужно определить стоимость",
  damage: "вам нужно подтвердить размер ущерба",
  technical: "вам нужны выводы о техническом состоянии или качестве работ",
  court: "вам нужны ответы на специальные вопросы для спора",
  unsure: "задача пока не определена",
};

function consult(reason: string, answers: Answers): Recommendation {
  return {
    kind: "consult",
    code: "konsultaciya",
    title: "Нужна консультация",
    reasons: [reason],
    notes: [
      "Опишите ситуацию в заявке своими словами — после предварительного анализа мы подскажем, какой документ может подойти и возможно ли решить задачу.",
    ],
    prepare: answers.object ? prepareByObject[answers.object] : prepareByObject.other,
    service: null,
    lawyers: answers.user === "lawyer",
  };
}

/** Все ли ответы даны. */
export function isComplete(answers: Answers): answers is Required<Answers> {
  return Boolean(answers.purpose && answers.caseStatus && answers.user && answers.object);
}

/**
 * Основное правило выбора. Порядок проверок важен: сначала противоречия и
 * неопределённость, затем судебный контекст, затем внесудебные задачи.
 */
export function recommend(answers: Required<Answers>): Recommendation {
  const { purpose, caseStatus, user, object } = answers;
  const courtCase = caseStatus === "in-court";
  const lawyers = user === "lawyer" || courtCase || caseStatus === "planning";

  // 1. Противоречие: документ «для суда», но дела нет и не планируется.
  if (user === "court" && (caseStatus === "none" || caseStatus === "unsure")) {
    return consult(
      "Вы указали, что документ нужен суду, но судебного дела пока нет. Судебная экспертиза назначается только в рамках рассматриваемого дела, поэтому по этим ответам нельзя сделать обоснованный вывод.",
      answers,
    );
  }

  // 2. Задача не определена.
  if (purpose === "unsure") {
    return consult("Задача пока не определена — по ответам нельзя обоснованно выбрать документ.", answers);
  }

  // 3. Неочевидные сочетания объекта и задачи.
  if (purpose === "technical" && (object === "business" || object === "other")) {
    return consult(
      object === "business"
        ? "Технические вопросы о бизнесе или доле обычно не ставятся — вероятно, задачу нужно уточнить."
        : "Для этого объекта нужно уточнить, какие именно технические вопросы требуется решить и входят ли они в компетенцию организации.",
      answers,
    );
  }
  if (purpose === "damage" && (object === "other" || object === "business")) {
    return consult("Определение ущерба для этого объекта требует уточнения задачи: от неё зависят исходные данные и вид работы.", answers);
  }

  // 4. Дело уже рассматривается судом.
  if (courtCase) {
    return {
      kind: "court",
      code: "ekspertiza",
      title: kindTitles.court,
      reasons: [
        "Спор уже рассматривается судом, и " + purposePhrase[purpose] + ".",
        "Если для ответа нужны специальные знания, сторона может заявить ходатайство о назначении экспертизы, предложить вопросы и экспертную организацию.",
      ],
      notes: [
        "Решение о назначении экспертизы, окончательный круг вопросов и выбор эксперта принимает суд.",
        "До назначения экспертизы можно уточнить у нас, возможно ли исследование, какие материалы нужны, каковы сроки и стоимость, — эти сведения обычно прикладывают к ходатайству.",
        purpose === "value" || purpose === "damage"
          ? "Сторона также может представить в суд отчёт об оценке как доказательство — суд оценит его наряду с другими."
          : "Сторона также может представить заключение специалиста, подготовленное по договору, — суд оценит его наряду с другими доказательствами.",
      ],
      prepare: ["Номер дела и наименование суда", "Предмет спора и вопросы, которые требуют специальных знаний", ...prepareByObject[object].slice(0, 2)],
      service: service("sudebnaya-ekspertiza"),
      lawyers: true,
    };
  }

  // 5. Внесудебные задачи (дела нет, планируется или вопрос открыт).
  const noCaseNote =
    caseStatus === "planning" || user === "court"
      ? "Если дело будет возбуждено и понадобятся специальные знания, суд может назначить судебную экспертизу — документ, подготовленный до суда, её не заменяет, но помогает оценить позицию."
      : "Судебная экспертиза назначается только в рамках судебного дела, поэтому сейчас она не единственный и не основной вариант.";

  if (purpose === "value") {
    const slug = serviceByObject[object].report;
    return {
      kind: "report",
      code: "otchet",
      title: kindTitles.report,
      reasons: [
        "Вам нужно определить стоимость объекта — это задача оценочной деятельности.",
        "Отчёт об оценке готовится по договору с заказчиком, в нём обосновывается стоимость на конкретную дату и для конкретной цели.",
      ],
      notes: [
        "Важно сразу назвать цель оценки (сделка, наследство, залог, спор) и дату: от них зависит вид стоимости.",
        ...(user === "organization" ? ["Уточните у банка, страховой компании или органа их требования к отчёту — это поможет подготовить подходящий документ."] : []),
        noCaseNote,
      ],
      prepare: [...prepareByObject[object], "Цель оценки и дата, на которую нужна стоимость"],
      service: service(slug),
      lawyers,
    };
  }

  if (purpose === "damage") {
    // Ущерб от строительных дефектов — сначала техническое исследование.
    if (object === "construction") {
      return {
        kind: "specialist",
        code: "zaklyuchenie",
        title: kindTitles.specialist,
        reasons: [
          "Ущерб связан с качеством строительных или ремонтных работ: сначала нужно установить дефекты и их характеристики.",
          "Строительно-техническое исследование может включать определение стоимости устранения дефектов, если этот вопрос поставлен и входит в компетенцию специалиста.",
        ],
        notes: [noCaseNote],
        prepare: prepareByObject.construction,
        service: service("stroitelno-tehnicheskaya-ekspertiza"),
        lawyers,
      };
    }
    const slug = serviceByObject[object].report;
    return {
      kind: "report",
      code: "otchet",
      title: kindTitles.report,
      reasons: [
        "Вам нужно подтвердить размер ущерба в денежном выражении — например, стоимость восстановительного ремонта.",
        "Такой расчёт оформляется отчётом об оценке по договору с заказчиком.",
      ],
      notes: [
        "Оценка определяет размер ущерба, но не устанавливает его причину и не определяет, кто виноват.",
        ...(object === "flood" ? ["Если причина залива спорна, может понадобиться строительно-техническое исследование."] : []),
        noCaseNote,
      ],
      prepare: prepareByObject[object],
      service: service(slug),
      lawyers,
    };
  }

  // technical или court без возбуждённого дела → заключение специалиста.
  const slug = serviceByObject[object].specialist;
  return {
    kind: "specialist",
    code: "zaklyuchenie",
    title: kindTitles.specialist,
    reasons: [
      purpose === "technical"
        ? "Вам нужны технические выводы — это задача исследования с применением специальных знаний."
        : "Дела в суде пока нет, а ответы на специальные вопросы нужны уже сейчас — например, чтобы оценить позицию или обосновать претензию.",
      "Заключение специалиста готовится по договору с заказчиком. Конкретный вид документа зависит от вопросов и процессуального контекста.",
    ],
    notes: [
      "Заключение специалиста не равнозначно заключению судебного эксперта: в суде оно оценивается наряду с другими доказательствами.",
      ...(purpose === "court" && (object === "realty" || object === "business" || object === "car")
        ? ["Если спор касается только стоимости объекта, может подойти и отчёт об оценке."]
        : []),
      noCaseNote,
    ],
    prepare: prepareByObject[object],
    service: service(slug),
    lawyers,
  };
}

/** Ссылка на форму заявки с контекстом рекомендации (без персональных данных). */
export function requestHref(rec: Recommendation, answers: Required<Answers>): string {
  const usluga =
    rec.kind === "court" ? "sudebnaya-ekspertiza" : rec.service ? rec.service.href.replace("/uslugi/", "") : "";
  const params = new URLSearchParams();
  if (usluga) params.set("usluga", usluga);
  params.set("rekomendaciya", rec.code);
  params.set("obekt", answers.object);
  return `/kontakty?${params.toString()}#zayavka`;
}

export const objectCodes = Object.keys(objectLabels) as ObjectType[];
export { objectLabels };
