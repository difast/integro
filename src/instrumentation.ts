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
}
