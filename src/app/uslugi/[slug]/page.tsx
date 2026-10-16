import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, FileText } from "lucide-react";
import { getService, services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DraftBadge } from "@/components/ui/DraftBadge";
import { ServiceIcon } from "@/components/ui/ServiceIcon";
import { CtaBand } from "@/components/sections/CtaBand";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return pageMetadata({ title: service.title, description: service.metaDescription, path: `/uslugi/${slug}` });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const scope = service.scope
    .map((group) => ({ ...group, items: group.items.filter((item) => showDraftContent || !item.draft) }))
    .filter((group) => group.items.length > 0);
  const others = services.filter((item) => item.slug !== service.slug);

  return (
    <>
      <PageHeader
        title={service.title}
        eyebrow="Услуги"
        crumbs={[{ label: "Услуги", href: "/uslugi" }, { label: service.title }]}
        lead={service.lead}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/kontakty?usluga=${service.slug}#zayavka`}>Оставить заявку</ButtonLink>
          <ButtonLink href="/poryadok-raboty" variant="outline">
            Порядок работы
          </ButtonLink>
        </div>
      </PageHeader>

      <div className="container-page grid gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20 lg:py-24">
        <div>
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="text-[1.75rem] font-extrabold tracking-[-0.02em] sm:text-[2.1rem]">
              Как это устроено
            </h2>
            <span className="rule mt-6" aria-hidden="true" />
            <div className="mt-8 max-w-[68ch] space-y-5 text-lg leading-relaxed">
              {service.about.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </section>

          {scope.map((group, groupIndex) => (
            <section key={group.heading} aria-labelledby={`scope-${groupIndex}`} className="mt-16">
              <h2 id={`scope-${groupIndex}`} className="text-2xl font-extrabold sm:text-[1.75rem]">
                {group.heading}
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li key={item.title} className="flex gap-3 rounded-xl bg-paper px-5 py-4">
                    <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2.4} />
                    <span className="font-semibold text-ink">
                      {item.title}
                      {item.draft ? <DraftBadge /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section aria-labelledby="prepare-title" className="mt-16">
            <h2 id="prepare-title" className="text-2xl font-extrabold sm:text-[1.75rem]">
              {service.prepare.heading}
            </h2>
            {service.prepare.intro ? (
              <p className="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">{service.prepare.intro}</p>
            ) : null}
            <ol className="mt-6 space-y-3">
              {service.prepare.items
                .filter((item) => showDraftContent || !item.draft)
                .map((item, index) => (
                  <li key={item.title} className="flex gap-4 border-b border-line pb-3">
                    <span className="w-6 shrink-0 text-sm font-extrabold text-accent tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink">{item.title}</span>
                  </li>
                ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[var(--radius-card)] bg-navy-900 p-7 text-white">
            <FileText aria-hidden="true" className="h-8 w-8 text-white/70" strokeWidth={1.6} />
            <p className="mt-5 text-xs font-bold tracking-[0.18em] text-white/60 uppercase">Итоговый документ</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{service.result.title}</h2>
            <p className="mt-3 leading-relaxed text-navy-200">{service.result.text}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line p-7">
            <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">Правовая основа</p>
            <dl className="mt-5 space-y-5">
              {service.basis.map((item) => (
                <div key={item.code}>
                  <dt className="text-lg font-extrabold text-ink">{item.code}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      <section aria-labelledby="other-title" className="bg-paper py-16 lg:py-20">
        <div className="container-page">
          <h2 id="other-title" className="text-2xl font-extrabold sm:text-[1.75rem]">
            Другие направления
          </h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {others.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/uslugi/${item.slug}`}
                  className="group flex h-full gap-5 rounded-[var(--radius-card)] bg-white p-7 transition-shadow hover:shadow-[0_18px_50px_-24px_rgba(10,20,48,0.35)]"
                >
                  <ServiceIcon name={item.icon} className="h-8 w-8 shrink-0 text-accent" />
                  <span>
                    <span className="block text-xl font-extrabold text-ink group-hover:text-accent">{item.title}</span>
                    <span className="mt-2 block leading-relaxed text-muted">{item.summary}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
                      Подробнее <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand service={service.slug} />
    </>
  );
}
