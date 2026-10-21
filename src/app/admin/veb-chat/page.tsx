import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { ChatList } from "@/components/admin/chat/ChatList";

export const metadata: Metadata = { title: "Веб-чат" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Раздел «Веб-чат»: диалоги онлайн-чата на сайте (тот же список и фильтры, что в «Обращениях», только канал web). */
export default async function AdminWebChatPage({ searchParams }: Props) {
  await requireAdminPage();
  return <ChatList params={await searchParams} basePath="/admin/veb-chat" fixedChannel="web" />;
}
