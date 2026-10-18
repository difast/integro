import Link from "next/link";
import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { audienceLabels, type AudienceKey } from "@/config/service-details";
import { phoneHref } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { DesktopNav, MobileMenu } from "./HeaderNav";

/**
 * Шапка в две строки (по референсу): сверху — логотип, разделы по типу
 * заказчика и действие; снизу — основная навигация по сайту.
 */
export function SiteHeader() {
  const { phone, email, workingHours } = company.contacts;
  const audiences = (Object.keys(audienceLabels) as AudienceKey[]).map((key) => ({
    label: audienceLabels[key],
    href: `/uslugi?dlya=${key}`,
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white lg:static">
      <div className="container-page flex h-16 items-center justify-between gap-6 lg:h-[76px]">
        <div className="flex items-center gap-10">
          <Logo />
          <nav aria-label="Для кого" className="hidden xl:block">
            <ul className="flex gap-6 text-[0.875rem] text-muted">
              {audiences.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="transition-colors hover:text-ink">
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex items-center gap-5">
          {phone ? (
            <a href={phoneHref(phone)} className="hidden text-[0.9375rem] font-medium text-ink lg:inline">
              {phone}
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="hidden text-[0.9375rem] text-ink hover:text-bronze-deep lg:inline">
              {email}
            </a>
          ) : null}
          <div className="hidden sm:block">
            <ButtonLink href="/kontakty#zayavka" className="min-h-11 px-5 text-[0.875rem]">
              Оставить заявку
            </ButtonLink>
          </div>
          <MobileMenu items={mainNav} audiences={audiences} phone={phone} email={email} workingHours={workingHours} />
        </div>
      </div>
      <div className="hidden border-t border-line lg:block">
        <div className="container-page flex h-[56px] items-stretch justify-between gap-6">
          <DesktopNav items={mainNav} />
          {workingHours ? (
            <p className="hidden items-center gap-2 text-[0.8125rem] whitespace-nowrap text-muted xl:flex">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-bronze" />
              {workingHours}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
