import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { services } from "@/config/services";
import { requireAdminPage } from "@/lib/admin/auth";
import { manualChannels } from "@/lib/requests/funnel";
import { ManualRequestForm } from "@/components/admin/ManualRequestForm";

export const metadata: Metadata = { title: "Новая заявка" };

export default async function NewRequestPage() {
  await requireAdminPage();
  return (
    <div className="container-page mt-8 max-w-3xl lg:mt-10">
      <Link href="/admin" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Все заявки
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Новая заявка</h1>
      <p className="mt-2 text-muted">
        Для обращений, которые не поступили через сайт или ботов: WhatsApp (переписка в приложении в систему не
        попадает), Авито, телефон, почта. Заявки из диалогов MAX и Telegram создаются из карточки диалога.
      </p>
      <section className="mt-6 rounded-[var(--radius-card)] bg-white p-5 sm:p-6">
        <ManualRequestForm channels={manualChannels.map((c) => ({ value: c.value, label: c.label }))} services={services.map((s) => ({ value: s.slug, label: s.title }))} />
      </section>
    </div>
  );
}
