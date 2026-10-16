import { company } from "@/config/company";

/** Описание оператора персональных данных из заполненных реквизитов. */
export function operatorDescription(): string {
  const { inn, ogrn, legalAddress } = company.requisites;
  const parts = [company.fullLegalName];
  if (inn) parts.push(`ИНН ${inn}`);
  if (ogrn) parts.push(`ОГРН ${ogrn}`);
  if (legalAddress) parts.push(`адрес: ${legalAddress}`);
  return parts.join(", ");
}

/** Куда субъект может направить обращение по вопросам персональных данных. */
export function operatorContactText(): string {
  const { email } = company.contacts;
  const { legalAddress } = company.requisites;
  if (email && legalAddress) {
    return `по электронной почте ${email} или почтовым отправлением по адресу: ${legalAddress}`;
  }
  if (email) return `по электронной почте ${email}`;
  if (legalAddress) return `почтовым отправлением по адресу: ${legalAddress}`;
  return "по контактам, указанным на странице «Контакты» сайта";
}
