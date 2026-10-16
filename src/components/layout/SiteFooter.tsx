import Link from "next/link";
import { company } from "@/config/company";
import { mainNav } from "@/config/content";
import { legalDocumentList, legalIndexPath } from "@/config/legal";
import { services } from "@/config/services";
import { requisitesLine } from "@/lib/organization";
import { copyrightYears, phoneHref, workingHoursInline } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";

type FooterLink = { label: string; href: string };

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <ul className="mt-5 space-y-3 text-[0.9375rem]">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-body transition-colors hover:text-ink hover:underline hover:underline-offset-4">
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
    <footer className="border-t-[3px] border-navy-900 bg-paper">
      <div className="container-page grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Logo />
          <div className="mt-8 space-y-3 text-[0.9375rem]">
            {workingHours ? (
              <p>
                <span className="text-muted">Часы связи: </span>
                {workingHoursInline()}
              </p>
            ) : null}
            {phone ? (
              <p>
                <a href={phoneHref(phone)} className="text-lg font-medium text-ink">
                  {phone}
                </a>
              </p>
            ) : null}
            {email ? (
              <p>
                <a href={`mailto:${email}`} className="text-link">
                  {email}
                </a>
              </p>
            ) : null}
            <p>
              <Link href="/kontakty#zayavka" className="text-link">
                Отправить заявку через сайт
              </Link>
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <FooterColumn
            title="Услуги"
            links={services.map((service) => ({ label: service.shortTitle, href: `/uslugi/${service.slug}` }))}
          />
        </div>
        <div className="lg:col-span-2">
          <FooterColumn title="Компания" links={mainNav.filter((item) => item.href !== "/uslugi")} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <FooterColumn
            title="Правовая информация"
            links={[
              ...legalDocumentList.map((doc) => ({ label: doc.title, href: doc.href })),
              { label: "Все документы", href: legalIndexPath },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-[0.8125rem] leading-relaxed text-muted lg:flex-row lg:justify-between lg:gap-8">
          <p>{requisitesLine()}</p>
          <p className="shrink-0">© {copyrightYears()}</p>
        </div>
      </div>
    </footer>
  );
}
