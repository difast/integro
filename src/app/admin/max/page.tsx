import { redirect } from "next/navigation";

/** Прежний адрес раздела MAX — теперь общий раздел обращений с фильтром по каналу. */
export default function LegacyMaxList() {
  redirect("/admin/obrashcheniya?channel=max");
}
