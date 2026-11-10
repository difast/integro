import { describeDbError, isDatabaseConfigured } from "@/lib/db";
import { buildTargetUrl, SLUG_RE } from "@/lib/marketing/links";
import { getActiveLinkBySlug, recordLinkClick } from "@/lib/marketing/repository";
import { isBotUserAgent } from "@/lib/stats/clicks";

export const dynamic = "force-dynamic";

/** Перенаправление на адрес этого же сайта: относительный Location работает и за прокси хостинга. */
function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/**
 * Короткая маркетинговая ссылка /go/<slug>. Засчитывает переход (без данных о посетителе; роботы и
 * сборщики превью ссылок не считаются) и ведёт на страницу сайта с UTM-метками. Неизвестная или
 * отключённая ссылка, как и сбой базы, ведёт на главную — посетитель не видит ошибку.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug) || !isDatabaseConfigured()) return redirect("/");
  try {
    const link = await getActiveLinkBySlug(slug);
    if (!link) return redirect("/");
    if (!isBotUserAgent(request.headers.get("user-agent"))) {
      await recordLinkClick(link.id).catch((error) => console.error("[go] click not recorded:", describeDbError(error)));
    }
    return redirect(buildTargetUrl(link));
  } catch (error) {
    console.error("[go] link lookup failed:", describeDbError(error));
    return redirect("/");
  }
}
