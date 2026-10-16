import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { phoneHref, workingHoursInline } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { DesktopNav, MobileMenu } from "./HeaderNav";

export function SiteHeader() {
  const { phone, email, workingHours } = company.contacts;

  return (
    <>
      {/* Служебная строка: только подтверждённые сведения (десктоп). */}
      <div className="hidden bg-navy-900 text-[0.8125rem] text-navy-300 lg:block">
        <div className="container-page flex h-9 items-center justify-between gap-6">
          <p>
            {company.legalName} · {company.tagline.toLowerCase()}
          </p>
          <div className="flex items-center gap-6">
            {workingHours ? <p>Часы связи: {workingHoursInline()}</p> : null}
            {phone ? (
              <a href={phoneHref(phone)} className="font-medium text-white hover:underline">
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="text-white hover:underline">
                {email}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="container-page flex h-[72px] items-center justify-between gap-6 lg:h-20">
          <Logo />
          <DesktopNav items={mainNav} />
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ButtonLink href="/kontakty#zayavka" className="min-h-11 px-5 text-[0.875rem]">
                Оставить заявку
              </ButtonLink>
            </div>
            <MobileMenu items={mainNav} phone={phone} email={email} workingHours={workingHoursInline()} />
          </div>
        </div>
      </header>
    </>
  );
}
