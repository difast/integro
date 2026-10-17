import Link from "next/link";
import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { legalDocumentList } from "@/config/legal";
import { services } from "@/config/services";
import { requisitesLine } from "@/lib/organization";
import { copyrightYears, phoneHref } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";

type FooterLink = { label: string; href: string };

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="text-[0.875rem] font-medium text-white">{title}</h2>
      <ul className="mt-5 space-y-3 text-[0.9375rem]">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-on-dark transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const { phone, email, workingHours } = company.contacts;

  return (
    <footer className="mt-20 bg-dark text-on-dark lg:mt-28">
      <div className="container-page grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Logo inverted />
          <p className="mt-6 max-w-xs text-[0.9375rem] leading-relaxed">
            Оценка имущества, судебная экспертиза и экспертные исследования.
          </p>
          <div className="mt-8 space-y-2 text-[0.9375rem]">
            {phone ? (
              <p>
                <a href={phoneHref(phone)} className="text-lg font-medium text-white">
                  {phone}
                </a>
              </p>
            ) : null}
            {email ? (
              <p>
                <a href={`mailto:${email}`} className="text-white underline decoration-bronze underline-offset-4">
                  {email}
                </a>
              </p>
            ) : null}
            {workingHours ? <p>{workingHours}</p> : null}
          </div>
        </div>
        <div className="lg:col-span-2">
          <FooterColumn
            title="Услуги"
            links={services.map((service) => ({ label: service.shortTitle, href: `/uslugi/${service.slug}` }))}
          />
        </div>
        <div className="lg:col-span-2">
          <FooterColumn
            title="Компания"
            links={mainNav.filter((item) => !["/uslugi", "/pravovaya-informaciya"].includes(item.href))}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <FooterColumn
            title="Правовая информация"
            links={legalDocumentList.map((doc) => ({ label: doc.title, href: doc.href }))}
          />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-[0.8125rem] leading-relaxed lg:flex-row lg:justify-between lg:gap-8">
          <p>{requisitesLine()}</p>
          <p className="shrink-0">© {copyrightYears()}</p>
        </div>
      </div>
    </footer>
  );
}
