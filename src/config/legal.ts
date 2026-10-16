/** Раздел «Правовая информация»: постоянные адреса и названия документов. */

export type LegalDocumentLink = {
  href: string;
  title: string;
  description: string;
};

export const legalIndexPath = "/pravovaya-informaciya";

export const legalDocuments = {
  organization: {
    href: `${legalIndexPath}/svedeniya-ob-organizacii`,
    title: "Сведения об организации",
    description: "Полное наименование, регистрационные данные, юридический адрес и часы связи.",
  },
  policy: {
    href: `${legalIndexPath}/politika-obrabotki-personalnyh-dannyh`,
    title: "Политика обработки персональных данных",
    description:
      "Цели, состав и правовые основания обработки, сроки, меры защиты и права субъектов персональных данных.",
  },
  consent: {
    href: `${legalIndexPath}/soglasie-na-obrabotku-personalnyh-dannyh`,
    title: "Согласие на обработку персональных данных",
    description: "Текст согласия, которое даёт посетитель сайта при отправке заявки через форму.",
  },
} satisfies Record<string, LegalDocumentLink>;

export const legalDocumentList: LegalDocumentLink[] = [
  legalDocuments.organization,
  legalDocuments.policy,
  legalDocuments.consent,
];
