import { defineConfig } from "@playwright/test";

/**
 * Сквозные тесты панели заявок и формы. Требуют собранного проекта (npm run build)
 * и тестовой базы PostgreSQL в TEST_DATABASE_URL — все данные в ней удаляются.
 *
 * Поднимаются два сервера: рабочий (порт 3201) и с недоступной базой (порт 3202)
 * для проверки, что ошибка базы не приводит к сообщению об успешной отправке.
 */
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-123";

const common = {
  ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  MAIL_TO: "",
  NODE_ENV: "production",
  SITE_URL: "https://intsoftholding.ru",
};

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3201", locale: "ru-RU" },
  webServer: [
    {
      command: "npx next start -p 3201",
      url: "http://localhost:3201/kontakty",
      env: { ...common, DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
      reuseExistingServer: false,
    },
    {
      command: "npx next start -p 3202",
      url: "http://localhost:3202/kontakty",
      env: { ...common, DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:9/none" },
      reuseExistingServer: false,
    },
  ],
});
