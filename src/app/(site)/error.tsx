"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="panel bg-white px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
      <p className="flex items-center gap-3 text-[0.875rem] font-medium text-muted"><span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />Ошибка</p>
      <h1 className="h-page mt-6 max-w-2xl">
        Что-то пошло не так
      </h1>
      <p className="lead mt-6 max-w-xl">
        При загрузке страницы произошла ошибка. Попробуйте обновить страницу или вернитесь на главную.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          Попробовать снова
        </button>
        <Link href="/" className={buttonClass("outline")}>
          На главную
        </Link>
      </div>
      </div>
    </section>
  );
}
