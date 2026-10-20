import { isAdmin } from "@/lib/admin/auth";
import { isSameOrigin, noStore } from "@/lib/admin/origin";
import { runBackup } from "@/lib/backup/run";

export const dynamic = "force-dynamic";

let lastDownload = 0;

/**
 * Скачивание зашифрованной резервной копии (AES-256-GCM; расшифровать можно только ключом
 * BACKUP_ENCRYPTION_KEY через npm run db:restore). Только после входа, только POST с этого сайта.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  if (Date.now() - lastDownload < 60_000) return new Response("Копию можно скачивать не чаще раза в минуту.", { status: 429, headers: noStore });
  lastDownload = Date.now();
  const result = await runBackup("manual", { upload: false, keepFile: true });
  if (!result.ok || !result.file) return new Response(`Копия не создана: ${result.ok ? "нет данных" : result.error}`, { status: 503, headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" } });
  const name = `integro-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.bak`;
  return new Response(new Uint8Array(result.file), {
    headers: { ...noStore, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
