import { redirect } from "next/navigation";
import { isUuid } from "@/lib/requests/repository";

/** Прежний адрес карточки MAX. */
export default async function LegacyMaxCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(isUuid(id) ? `/admin/obrashcheniya/${id}` : "/admin/obrashcheniya");
}
