import { isAdmin } from "@/lib/admin/auth";
import { noStore } from "@/lib/admin/origin";
import { describeDbError } from "@/lib/db";
import { getRequestFile } from "@/lib/requests/files";

export const dynamic = "force-dynamic";

/** Имя для заголовка Content-Disposition: ASCII-замена и полное имя в UTF-8 (RFC 6266/5987). */
function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Скачивание файла, приложенного к заявке. Только для администратора и только как вложение:
 * браузер не открывает файл на странице сайта, даже если это изображение или PDF.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  const { id, fileId } = await params;
  try {
    const file = await getRequestFile(id, fileId);
    if (!file) return Response.json({ error: "Not found" }, { status: 404, headers: noStore });
    return new Response(new Uint8Array(file.data), {
      headers: {
        ...noStore,
        "Content-Type": file.mime,
        "Content-Length": String(file.data.length),
        "Content-Disposition": contentDisposition(file.name),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("[admin] request file download failed:", describeDbError(error));
    return Response.json({ error: "Download failed" }, { status: 500, headers: noStore });
  }
}
