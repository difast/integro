import { company, type Requisites } from "@/config/company";

export type DetailRow = { label: string; value: string };

const requisiteLabels: Record<keyof Requisites, string> = {
  ogrn: "ОГРН",
  inn: "ИНН",
  kpp: "КПП",
  legalAddress: "Юридический адрес",
  director: "Генеральный директор",
  bankAccount: "Расчётный счёт",
  bankName: "Банк",
  bik: "БИК",
  correspondentAccount: "Корреспондентский счёт",
};

/** Заполненные реквизиты в фиксированном порядке. */
export function filledRequisites(): DetailRow[] {
  return (Object.keys(requisiteLabels) as (keyof Requisites)[])
    .map((key) => ({ label: requisiteLabels[key], value: company.requisites[key] }))
    .filter((row): row is DetailRow => Boolean(row.value));
}

/** Официальные сведения об организации — единый формат для всего сайта. */
export function organizationDetails(): DetailRow[] {
  const rows: DetailRow[] = [
    { label: "Полное наименование", value: company.fullLegalName },
    { label: "Сокращённое наименование", value: company.legalName },
    ...filledRequisites(),
  ];
  if (company.contacts.workingHours) rows.push({ label: "Часы связи", value: company.contacts.workingHours });
  return rows;
}

/** Короткая строка реквизитов для подвала и документов. */
export function requisitesLine(): string {
  const { ogrn, inn, kpp, legalAddress } = company.requisites;
  return [
    company.legalName,
    ogrn && `ОГРН ${ogrn}`,
    inn && `ИНН ${inn}`,
    kpp && `КПП ${kpp}`,
    legalAddress,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Оператор персональных данных в тексте документов. */
export function operatorFullDescription(): string {
  const { ogrn, inn, kpp, legalAddress } = company.requisites;
  const parts = [company.fullLegalName + ` (${company.legalName})`];
  if (ogrn) parts.push(`ОГРН ${ogrn}`);
  if (inn) parts.push(`ИНН ${inn}`);
  if (kpp) parts.push(`КПП ${kpp}`);
  if (legalAddress) parts.push(`адрес: ${legalAddress}`);
  return parts.join(", ");
}
