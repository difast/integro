import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { audienceLabels, type AudienceKey } from "@/config/service-details";
import { phoneHref } from "@/lib/site";
import { RequestButton } from "@/components/request/RequestButton";
import { getMessengers, MessengerLinks } from "@/components/ui/MessengerLinks";
import { Logo } from "@/components/ui/Logo";
import { DesktopNav, MobileMenu } from "./HeaderNav";

/**
 * Шапка в две строки (по референсу): сверху — логотип, телефон, почта и действие;
 * снизу — основная навигация по сайту. Разделы по типу заказчика — в мобильном меню,
 * на главной и в каталоге услуг.
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
        <Logo />
        <div className="flex items-center gap-5">
          {phone ? (
            <a href={phoneHref(phone)} className="hidden text-[1.1875rem] font-bold tracking-tight whitespace-nowrap text-ink hover:text-bronze-deep lg:inline">
              {phone}
            </a>
          ) : null}
          <MessengerLinks variant="compact" className="hidden lg:flex" />
          {email ? (
            <a href={`mailto:${email}`} className="hidden text-[0.9375rem] whitespace-nowrap text-ink hover:text-bronze-deep lg:inline">
              {email}
            </a>
          ) : null}
          <div className="hidden sm:block">
            <RequestButton className="min-h-11 px-5 text-[0.875rem] whitespace-nowrap">
              Оставить заявку
            </RequestButton>
          </div>
          <MobileMenu
            items={mainNav}
            audiences={audiences}
            phone={phone}
            email={email}
            workingHours={workingHours}
            messengers={getMessengers()}
          />
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
