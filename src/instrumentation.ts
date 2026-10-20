/**
 * Выполняется один раз при запуске сервера: если база подключена, применяет
 * миграции и сообщает в журнал о результате (без строки подключения и паролей).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Во время сборки (next build) к базе не подключаемся.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Состояние почтовых уведомлений — без паролей.
  const { getMailConfig } = await import("@/lib/mail");
  const mail = getMailConfig();
  console.info(
    mail
      ? `[mail] notifications on: ${mail.host}:${mail.port}, from ${mail.from} to ${mail.to.join(", ")}`
      : "[mail] notifications off: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD to receive emails about new requests",
  );

  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[db] DATABASE_URL is not set: requests are not saved to the database, /admin login is disabled");
    return;
  }
  const { ensureSchema, describeDbError } = await import("@/lib/db");
  try {
    await ensureSchema();
    console.info("[db] connected, schema is up to date");
  } catch (error) {
    console.error("[db] database is unavailable:", describeDbError(error));
  }

  // Чат-боты MAX и Telegram: состояние настройки (без токенов и секретов) и фоновая досылка раз в минуту.
  const { getMaxConfig, isMaxEnabled, maxProblemText } = await import("@/lib/max/config");
  const { getTelegramConfig, isTelegramEnabled, telegramProblemText } = await import("@/lib/telegram/config");
  const max = getMaxConfig();
  const telegram = getTelegramConfig();
  const urlProblem = (p: string) => p === "webhook_url_missing" || p === "webhook_url_invalid";
  if (isMaxEnabled(max)) console.info(`[max] chat bot on, webhook ${max.webhookUrl ?? "(MAX_WEBHOOK_URL is not set)"}`);
  else console.info(`[max] chat bot off: ${max.problems.filter((p) => !urlProblem(p)).map((p) => maxProblemText[p]).join(" ")}`);
  if (isTelegramEnabled(telegram)) console.info(`[telegram] bot on, webhook ${telegram.webhookUrl ?? "(TELEGRAM_WEBHOOK_URL is not set)"}`);
  else console.info(`[telegram] bot off: ${telegram.problems.filter((p) => !urlProblem(p)).map((p) => telegramProblemText[p]).join(" ")}`);
  if (!isMaxEnabled(max) && !isTelegramEnabled(telegram)) return;
  const { sweepChats } = await import("@/lib/chat/processor");
  const timer = setInterval(() => void sweepChats(), 60_000);
  timer.unref?.();
}
