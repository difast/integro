import { defineConfig } from "@playwright/test";

/**
 * Сквозные тесты панели заявок и формы. Требуют собранного проекта (npm run build)
 * и тестовой базы PostgreSQL в TEST_DATABASE_URL — все данные в ней удаляются.
 *
 * Поднимаются два сервера: рабочий (порт 3201) и с недоступной базой (порт 3202)
 * для проверки, что ошибка базы не приводит к сообщению об успешной отправке,
 * и имитации MAX Bot API (порт 3203) и Telegram Bot API (порт 3204) для проверки чат-ботов.
 */
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-123";
export const E2E_MAX_TOKEN = "e2e-max-token";
export const E2E_MAX_SECRET = "e2e-max-webhook-secret-0123456789abcdef";
export const E2E_MAX_MOCK = "http://127.0.0.1:3203";
export const E2E_TG_TOKEN = "123456789:AAE_e2e-telegram-token-0123456789";
export const E2E_TG_SECRET = "e2e-telegram-webhook-secret-0123456789abcdef";
export const E2E_TG_MOCK = "http://127.0.0.1:3204";

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
      command: "node tests/e2e/max-mock-server.mjs 3203",
      url: `${E2E_MAX_MOCK}/__health`,
      env: { MAX_MOCK_TOKEN: E2E_MAX_TOKEN },
      reuseExistingServer: false,
    },
    {
      command: "node tests/e2e/telegram-mock-server.mjs 3204",
      url: `${E2E_TG_MOCK}/__health`,
      env: { TG_MOCK_TOKEN: E2E_TG_TOKEN },
      reuseExistingServer: false,
    },
    {
      command: "npx next start -p 3201",
      url: "http://localhost:3201/kontakty",
      env: {
        ...common,
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        // Чат-бот MAX с имитацией API (tests/e2e/max-mock-server.mjs).
        MAX_BOT_TOKEN: E2E_MAX_TOKEN,
        MAX_WEBHOOK_SECRET: E2E_MAX_SECRET,
        MAX_API_BASE_URL: E2E_MAX_MOCK,
        // Telegram-бот с имитацией Bot API (tests/e2e/telegram-mock-server.mjs).
        TELEGRAM_BOT_TOKEN: E2E_TG_TOKEN,
        TELEGRAM_WEBHOOK_SECRET: E2E_TG_SECRET,
        TELEGRAM_BOT_USERNAME: "integro_test_bot",
        TELEGRAM_API_BASE_URL: E2E_TG_MOCK,
      },
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
