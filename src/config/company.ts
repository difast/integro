/**
 * Единый источник данных о компании.
 *
 * Все значения `null` — сведения, которые ещё не предоставлены. Пока поле пустое,
 * соответствующий элемент на сайте просто не выводится (никаких заглушек и
 * выдуманных данных). Перечень полей для заполнения — в CONTENT_TODO.md.
 */

export type Requisites = {
  /** ИНН */
  inn: string | null;
  /** КПП */
  kpp: string | null;
  /** ОГРН */
  ogrn: string | null;
  /** Юридический адрес */
  legalAddress: string | null;
  /** Расчётный счёт */
  bankAccount: string | null;
  /** Наименование банка */
  bankName: string | null;
  /** БИК */
  bik: string | null;
  /** Корреспондентский счёт */
  correspondentAccount: string | null;
  /** Генеральный директор (ФИО) */
  director: string | null;
};

export type Contacts = {
  /** Телефон в читаемом виде, например "+7 (495) 000-00-00" */
  phone: string | null;
  /** Электронная почта для обращений */
  email: string | null;
  /** Фактический адрес офиса для посетителей */
  officeAddress: string | null;
  /** Часы связи, например "Ежедневно с 10:00 до 20:00 по московскому времени" */
  workingHours: string | null;
};

export type SocialLink = {
  label: string;
  href: string;
};

export type Company = {
  /** Краткое название бренда для логотипа и заголовков */
  shortName: string;
  /** Сокращённое наименование юрлица */
  legalName: string;
  /** Полное наименование юрлица */
  fullLegalName: string;
  /** Короткая характеристика деятельности (подпись к логотипу, meta) */
  tagline: string;
  /**
   * Основной домен сайта без завершающего слеша, например "https://integro-ocenka.ru".
   * Используется для canonical, sitemap.xml, robots.txt и Open Graph.
   * Может быть переопределён переменной окружения SITE_URL.
   */
  siteUrl: string | null;
  contacts: Contacts;
  requisites: Requisites;
  social: SocialLink[];
  /** Год, с которого указывается копирайт. null — только текущий год. */
  copyrightSince: number | null;
  /**
   * Дата размещения на сайте текущей редакции юридических документов
   * (политика, согласие). Это не дата утверждения — см. LEGAL_REVIEW.md.
   */
  legalRevisionDate: string;
};

export const company: Company = {
  shortName: "Интегро",
  legalName: "ООО «Интегро»",
  fullLegalName: "Общество с ограниченной ответственностью «Интегро»",
  tagline: "Оценка и судебная экспертиза",
  siteUrl: "https://intsoftholding.ru",
  contacts: {
    phone: null,
    email: "info@intsoftholding.ru",
    officeAddress: null,
    workingHours: "Ежедневно с 10:00 до 20:00 по московскому времени",
  },
  requisites: {
    inn: "9734021152",
    kpp: "773401001",
    ogrn: "1257700559269",
    legalAddress: "123592, город Москва, ул. Маршала Катукова, д. 22, к. 1",
    bankAccount: null,
    bankName: null,
    bik: null,
    correspondentAccount: null,
    director: null,
  },
  social: [],
  copyrightSince: null,
  legalRevisionDate: "18.10.2026",
};
