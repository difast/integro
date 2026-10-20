/** Общие типы и правила формы обращения (используются на сервере и клиенте). */

export type RequestFields = {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
};

export type RequestFieldName = keyof RequestFields | "consent";

export type RequestFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<RequestFieldName, string>>;
  values?: Partial<RequestFields>;
};

export const initialRequestState: RequestFormState = { status: "idle" };

export const limits = {
  name: 100,
  phone: 30,
  email: 120,
  message: 3000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Допустимые символы номера: цифры, пробелы, «+», скобки, дефис и точка.
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

/** Номер телефона: допустимые символы и 10–15 цифр (те же правила для сайта и чат-бота). */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return PHONE_CHARS_RE.test(phone) && digits.length >= 10 && digits.length <= 15;
}

/**
 * Проверка полей формы — одна и та же в браузере (до отправки) и на сервере.
 * Значения должны быть уже обрезаны по краям. Направление проверяется только на сервере.
 */
export function validateRequest(
  values: Omit<RequestFields, "service">,
  consent: boolean,
): Partial<Record<RequestFieldName, string>> {
  const errors: Partial<Record<RequestFieldName, string>> = {};
  if (values.name.length < 2) errors.name = "Укажите, как к вам обращаться";
  else if (values.name.length > limits.name) errors.name = `Не более ${limits.name} символов`;

  if (values.phone && !isValidPhone(values.phone)) errors.phone = "Проверьте номер телефона";
  if (values.email && (!EMAIL_RE.test(values.email) || values.email.length > limits.email)) {
    errors.email = "Проверьте адрес электронной почты";
  }
  if (!values.phone && !values.email) errors.phone = "Укажите телефон или электронную почту для ответа";

  if (values.message.length < 10) errors.message = "Кратко опишите задачу (не менее 10 символов)";
  else if (values.message.length > limits.message) errors.message = `Не более ${limits.message} символов`;

  if (!consent) errors.consent = "Необходимо согласие на обработку персональных данных";
  return errors;
}
