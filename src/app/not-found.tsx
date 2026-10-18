import type { Metadata } from "next";
import Link from "next/link";
import { mainNav } from "@/config/content";
import { ButtonLink } from "@/components/ui/Button";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { RequestButton } from "@/components/request/RequestButton";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false },
};

export default function NotFound() {
  // Корневая страница 404 находится вне группы (site), поэтому оформление подключается здесь.
  return (
    <SiteChrome>
      <section className="container-page pt-6 sm:pt-8">
        <div className="panel bg-white px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
          <p className="flex items-center gap-3 text-[0.875rem] font-medium text-muted">
            <span aria-hidden="true" className="h-[2px] w-8 bg-bronze" />
            Ошибка 404
          </p>
          <h1 className="h-page mt-6 max-w-2xl">Страница не найдена</h1>
          <p className="lead mt-6 max-w-xl">
            Возможно, адрес введён с ошибкой или страница была перемещена.
            Перейдите на главную или в один из разделов сайта.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/">На главную</ButtonLink>
            <RequestButton variant="outline">
              Оставить заявку
            </RequestButton>
          </div>
          <nav
            aria-label="Разделы сайта"
            className="mt-14 border-t border-line pt-6"
          >
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </SiteChrome>
  );
}
