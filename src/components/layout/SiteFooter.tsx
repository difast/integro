import Link from "next/link";
import { company } from "@/config/company";
import { clientLinks, mainNav } from "@/config/content";
import { services } from "@/config/services";
import { copyrightYears, hasAnyContact } from "@/lib/site";
import { ContactList } from "@/components/ui/ContactList";
import { Logo } from "@/components/ui/Logo";

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{title}</h2>
      <span className="mt-3 block h-[3px] w-6 bg-navy-700" aria-hidden="true" />
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted transition-colors hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const { legalAddress, inn, ogrn } = company.requisites;

  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:py-16">
        <div>
          <Logo />
          <p className="mt-6 max-w-xs leading-relaxed text-muted">
            {company.legalName} — оценочная деятельность, судебная экспертиза и экспертные исследования.
          </p>
        </div>

        <FooterColumn
          title="Услуги"
          links={services.map((service) => ({ label: service.title, href: `/uslugi/${service.slug}` }))}
        />
        <FooterColumn title="Клиентам" links={[...clientLinks, ...mainNav.filter((item) => item.href === "/o-kompanii")]} />

        <div>
          <h2 className="text-xs font-bold tracking-[0.18em] text-ink uppercase">Контакты</h2>
          <span className="mt-3 block h-[3px] w-6 bg-navy-700" aria-hidden="true" />
          <div className="mt-5">
            {hasAnyContact() ? (
              <ContactList />
            ) : (
              <Link href="/kontakty#zayavka" className="link-underline font-semibold text-ink">
                Отправить обращение
              </Link>
            )}
          </div>
          {company.social.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {company.social.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {legalAddress ? (
            <p className="mt-6 text-sm leading-relaxed text-muted">Юридический адрес: {legalAddress}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {copyrightYears()} {company.legalName}
            {inn ? <span> · ИНН {inn}</span> : null}
            {ogrn ? <span> · ОГРН {ogrn}</span> : null}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/politika-konfidencialnosti" className="link-underline">
              Политика обработки персональных данных
            </Link>
            <Link href="/soglasie-na-obrabotku" className="link-underline">
              Согласие на обработку данных
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
