import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { ChatList } from "@/components/admin/chat/ChatList";

export const metadata: Metadata = { title: "Обращения из мессенджеров" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminChatsPage({ searchParams }: Props) {
  await requireAdminPage();
  return <ChatList params={await searchParams} basePath="/admin/obrashcheniya" />;
}
