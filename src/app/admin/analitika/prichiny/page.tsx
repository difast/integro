import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { describeDbError } from "@/lib/db";
import { listLossReasons } from "@/lib/requests/repository";
import { LossReasonForm } from "@/components/admin/LossReasonForm";

export const metadata: Metadata = { title: "Причины отказа" };

export default async function LossReasonsPage() {
  await requireAdminPage();
  let reasons: Awaited<ReturnType<typeof listLossReasons>> | null = null;
  try {
    reasons = await listLossReasons(true);
  } catch (error) {
    console.error("[admin] failed to load loss reasons:", describeDbError(error));
  }
  return (
    <div className="container-page mt-8 max-w-3xl pb-12 lg:mt-10">
      <Link href="/admin/analitika" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink hover:text-bronze-deep">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Аналитика
      </Link>
      <h1 className="mt-5 text-[2rem] leading-tight">Причины отказа</h1>
      <p className="mt-2 text-muted">
        Выбираются при переводе заявки в этап «Сделка проиграна». Отключённая причина не предлагается для новых заявок, но
        остаётся в уже закрытых и в аналитике. Порядок — по возрастанию числа.
      </p>
      {reasons ? (
        <ul className="mt-6 space-y-3">
          {reasons.map((reason) => (
            <li key={reason.id} className="rounded-[var(--radius-card)] bg-white p-4">
              <LossReasonForm reason={reason} />
            </li>
          ))}
          <li className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white p-4">
            <LossReasonForm />
          </li>
        </ul>
      ) : (
        <p role="alert" className="mt-6 rounded-[var(--radius-card)] border-l-[3px] border-danger bg-white p-6 text-muted">
          База данных недоступна. Обновите страницу позже.
        </p>
      )}
    </div>
  );
}
