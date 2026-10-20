import { redirect } from "next/navigation";

/** Прежний адрес настроек MAX. */
export default function LegacyMaxSettings() {
  redirect("/admin/obrashcheniya/nastroyki");
}
