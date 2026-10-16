"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-page py-20 lg:py-32">
      <p className="text-sm font-extrabold tracking-[0.18em] text-accent">ОШИБКА</p>
      <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-extrabold tracking-[-0.025em] sm:text-5xl">
        Что-то пошло не так
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
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
    </section>
  );
}
