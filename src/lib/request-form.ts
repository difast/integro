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
