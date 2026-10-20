/**
 * Резервные копии базы сайта из командной строки (см. ADMIN_OPERATIONS.md).
 *
 *   npm run db:backup -- --out backup.bak                       копия текущей базы (DATABASE_URL) в файл
 *   npm run db:backup -- list                                   копии в хранилище S3
 *   npm run db:restore -- --file backup.bak --target <URL>      восстановление из файла в базу <URL>
 *   npm run db:restore -- --s3-key <ключ> --target <URL>        восстановление из хранилища S3
 *
 * Нужен BACKUP_ENCRYPTION_KEY (тот же, что на сервере). Восстановление в базу из DATABASE_URL (рабочую)
 * выполняется только с флагом --allow-production: сначала проверяйте копию на отдельной базе.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { getBackupConfig } from "../src/lib/backup/config";
import { decryptBackup, encryptBackup, restoreTables, runDump } from "../src/lib/backup/format";
import { s3Get, s3List } from "../src/lib/backup/s3";
import { buildPoolConfig } from "../src/lib/db/config";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function connect(url: string): Client {
  return new Client(buildPoolConfig({ ...process.env, DATABASE_URL: url }));
}

function sameDatabase(a: string, b: string | undefined): boolean {
  if (!b) return false;
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname === y.hostname && (x.port || "5432") === (y.port || "5432") && x.pathname === y.pathname;
  } catch {
    return a === b;
  }
}

async function main() {
  const command = process.argv[2];
  const config = getBackupConfig();

  if (command === "list") {
    if (!config.s3) throw new Error("Хранилище S3 не настроено (BACKUP_S3_*).");
    for (const item of await s3List(config.s3, config.prefix)) console.log(`${item.lastModified}  ${item.size} байт  ${item.key}`);
    return;
  }

  if (!config.key) throw new Error(config.problems[0] ?? "Не задан BACKUP_ENCRYPTION_KEY.");

  if (command === "backup") {
    const out = arg("out");
    const source = arg("source") ?? process.env.DATABASE_URL;
    if (!out || !source) throw new Error("Укажите --out <файл> (и DATABASE_URL или --source <URL>).");
    const client = connect(source);
    await client.connect();
    try {
      const dump = await runDump(client);
      writeFileSync(out, encryptBackup(dump.data, config.key), { mode: 0o600 });
      console.log(`Готово: ${out}, строк: ${dump.rows}, таблиц: ${dump.tables}.`);
    } finally {
      await client.end();
    }
    return;
  }

  if (command === "restore") {
    const target = arg("target");
    if (!target) throw new Error("Укажите базу для восстановления: --target <URL>.");
    if (sameDatabase(target, process.env.DATABASE_URL) && !process.argv.includes("--allow-production")) {
      throw new Error("--target совпадает с DATABASE_URL (рабочая база). Сначала проверьте копию на отдельной базе; для восстановления поверх рабочей базы добавьте --allow-production.");
    }
    const file = arg("file");
    const s3Key = arg("s3-key");
    let encrypted: Buffer;
    if (file) encrypted = readFileSync(file);
    else if (s3Key && config.s3) encrypted = await s3Get(config.s3, s3Key);
    else throw new Error("Укажите --file <файл> или --s3-key <ключ> (для S3 нужны BACKUP_S3_*).");
    const data = decryptBackup(encrypted, config.key);
    const client = connect(target);
    await client.connect();
    try {
      const result = await restoreTables(client, data);
      console.log(`Восстановлено строк: ${result.rows}, таблиц: ${result.tables}. Копия от ${result.createdAt}.`);
    } finally {
      await client.end();
    }
    return;
  }

  console.log("Команды: backup --out <файл> | list | restore (--file <файл> | --s3-key <ключ>) --target <URL> [--allow-production]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
