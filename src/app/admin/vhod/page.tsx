import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { LoginForm } from "@/components/admin/LoginForm";
import { adminSetupProblems, isAdmin, type AdminSetupProblem } from "@/lib/admin/auth";
import { ADMIN_PASSWORD_MIN_LENGTH } from "@/lib/admin/password";

export const metadata: Metadata = { title: "Вход" };

const problemText: Record<AdminSetupProblem, string> = {
  password_missing: "На сервере не задана переменная окружения ADMIN_PASSWORD.",
  password_too_short: `Пароль в переменной ADMIN_PASSWORD короче ${ADMIN_PASSWORD_MIN_LENGTH} символов.`,
  database_missing: "Не подключена база данных: на сервере не задана переменная DATABASE_URL.",
};

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const problems = adminSetupProblems();

  return (
    <div className="container-page mt-10 lg:mt-16">
      <div className="mx-auto max-w-md rounded-[var(--radius-panel)] bg-white p-6 sm:p-10">
        <p className="flex items-center gap-3 text-[0.875rem] font-medium text-muted">
          <span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />
          Закрытый раздел
        </p>
        <h1 className="mt-4 text-[1.75rem] leading-tight">Вход в панель заявок</h1>

        {problems.length > 0 ? (
          <div className="mt-8 flex gap-3 rounded-[var(--radius-control)] border-l-[3px] border-bronze bg-mist p-4 text-[0.9375rem] leading-relaxed text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Вход отключён до завершения настройки сервера.</p>
              <ul className="mt-2 space-y-1">
                {problems.map((problem) => (
                  <li key={problem}>{problemText[problem]}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted">
                Задайте переменные в настройках приложения Timeweb и перезапустите приложение (см. README).
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <LoginForm />
          </div>
        )}
      </div>
    </div>
  );
}
