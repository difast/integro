import { Phone } from "lucide-react";
import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { phoneHref } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { DesktopNav, MobileMenu } from "./HeaderNav";

export function SiteHeader() {
  const { phone, email } = company.contacts;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="container-page flex h-[76px] items-center justify-between gap-6 lg:h-[88px]">
        <Logo />
        <DesktopNav items={mainNav} />
        <div className="flex items-center gap-3">
          {phone ? (
            <a
              href={phoneHref(phone)}
              className="hidden items-center gap-2 text-[0.95rem] font-bold whitespace-nowrap text-ink transition-colors hover:text-accent xl:inline-flex"
            >
              <Phone aria-hidden="true" className="h-4 w-4 text-accent" strokeWidth={2} />
              {phone}
            </a>
          ) : null}
          <div className="hidden sm:block">
            <ButtonLink href="/kontakty#zayavka" className="px-5 py-3 text-sm">
              Оставить заявку
            </ButtonLink>
          </div>
          <MobileMenu items={mainNav} phone={phone} email={email} />
        </div>
      </div>
    </header>
  );
}
