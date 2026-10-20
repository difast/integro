import { parseBackupKey } from "./format";
import type { S3Config } from "./s3";

/**
 * Настройки резервного копирования (переменные окружения, только на сервере).
 * BACKUP_ENCRYPTION_KEY       — ключ шифрования копий, 32 байта: 64 hex-символа (openssl rand -hex 32). Без него копии не создаются.
 * BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY —
 *                               внешнее S3-хранилище для автоматических копий (необязательно).
 * BACKUP_S3_PREFIX            — папка в хранилище, по умолчанию integro-backups/.
 * BACKUP_HOUR_MSK             — час ежедневной копии по Москве (0–23), по умолчанию 3.
 * BACKUP_RETENTION_DAYS       — сколько дней хранить копии в хранилище, по умолчанию 30.
 */
export type BackupConfig = {
  key: Buffer | null;
  s3: S3Config | null;
  prefix: string;
  hourMsk: number;
  retentionDays: number;
  problems: string[];
};

export function getBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const problems: string[] = [];
  const key = parseBackupKey(env.BACKUP_ENCRYPTION_KEY);
  if (!env.BACKUP_ENCRYPTION_KEY?.trim()) problems.push("Не задан BACKUP_ENCRYPTION_KEY — копии не создаются.");
  else if (!key) problems.push("BACKUP_ENCRYPTION_KEY должен быть 64 hex-символа (openssl rand -hex 32).");

  const fields = ["BACKUP_S3_ENDPOINT", "BACKUP_S3_BUCKET", "BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY"] as const;
  const present = fields.filter((f) => env[f]?.trim());
  let s3: S3Config | null = null;
  if (present.length === fields.length) {
    const endpoint = env.BACKUP_S3_ENDPOINT!.trim();
    if (!/^https:\/\//.test(endpoint)) problems.push("BACKUP_S3_ENDPOINT должен начинаться с https://.");
    else
      s3 = {
        endpoint,
        region: env.BACKUP_S3_REGION?.trim() || "ru-1",
        bucket: env.BACKUP_S3_BUCKET!.trim(),
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID!.trim(),
        secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY!.trim(),
      };
  } else if (present.length > 0) {
    problems.push(`Хранилище S3 настроено не полностью: не заданы ${fields.filter((f) => !present.includes(f)).join(", ")}.`);
  }

  const hour = Number(env.BACKUP_HOUR_MSK ?? 3);
  const retention = Number(env.BACKUP_RETENTION_DAYS ?? 30);
  return {
    key,
    s3,
    prefix: (env.BACKUP_S3_PREFIX?.trim() || "integro-backups/").replace(/^\/+/, ""),
    hourMsk: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 3,
    retentionDays: Number.isInteger(retention) && retention >= 1 && retention <= 3650 ? retention : 30,
    problems,
  };
}

/** Автоматические копии работают, когда задан ключ и хранилище. */
export const isScheduledBackupEnabled = (config: BackupConfig) => Boolean(config.key && config.s3);
