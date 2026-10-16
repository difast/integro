import type { Metadata } from "next";
import Link from "next/link";
import { mainNav } from "@/config/content";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="container-page py-20 lg:py-32">
      <p className="text-sm font-extrabold tracking-[0.18em] text-accent">ОШИБКА 404</p>
      <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-extrabold tracking-[-0.025em] sm:text-5xl">
        Страница не найдена
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        Возможно, адрес введён с ошибкой или страница была перемещена. Перейдите на главную или в один из разделов
        сайта.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/">На главную</ButtonLink>
        <ButtonLink href="/kontakty#zayavka" variant="outline">
          Оставить заявку
        </ButtonLink>
      </div>
      <nav aria-label="Разделы сайта" className="mt-14 border-t border-line pt-8">
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="link-underline font-semibold text-ink">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
