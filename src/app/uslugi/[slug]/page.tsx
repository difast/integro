import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getService, services } from "@/config/services";
import { pageMetadata } from "@/lib/metadata";
import { showDraftContent } from "@/lib/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DraftBadge } from "@/components/ui/DraftBadge";
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

function SubHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="border-t border-ink pt-6 text-[1.375rem] leading-snug sm:text-[1.5rem]">
      {children}
    </h2>
  );
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const scope = service.scope
    .map((group) => ({ ...group, items: group.items.filter((item) => showDraftContent || !item.draft) }))
    .filter((group) => group.items.length > 0);
  const prepare = service.prepare.items.filter((item) => showDraftContent || !item.draft);
  const others = services.filter((item) => item.slug !== service.slug);

  return (
    <>
      <PageHeader
        title={service.title}
        crumbs={[{ label: "Услуги", href: "/uslugi" }, { label: service.title }]}
        lead={service.lead}
      >
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/kontakty?usluga=${service.slug}#zayavka`}>Оставить заявку</ButtonLink>
          <ButtonLink href="/poryadok-raboty" variant="outline">
            Порядок работы
          </ButtonLink>
        </div>
      </PageHeader>

      <div className="container-page grid gap-14 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24">
        <div className="space-y-16 lg:col-span-8 lg:pr-8">
          <section aria-labelledby="about-title">
            <SubHeading id="about-title">Как это устроено</SubHeading>
            <div className="prose-text mt-6">
              {service.about.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </section>

          {scope.map((group, groupIndex) => (
            <section key={group.heading} aria-labelledby={`scope-${groupIndex}`}>
              <SubHeading id={`scope-${groupIndex}`}>{group.heading}</SubHeading>
              <ul className="mt-6 grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
                {group.items.map((item) => (
                  <li key={item.title} className="border-b border-line py-3.5 text-ink">
                    {item.title}
                    {item.draft ? <DraftBadge /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section aria-labelledby="prepare-title">
            <SubHeading id="prepare-title">{service.prepare.heading}</SubHeading>
            {service.prepare.intro ? <p className="mt-5 max-w-[68ch] text-muted">{service.prepare.intro}</p> : null}
            <ol className="mt-6 border-t border-line">
              {prepare.map((item, index) => (
                <li key={item.title} className="grid grid-cols-[2.5rem_1fr] border-b border-line py-3.5">
                  <span className="text-[0.875rem] font-medium text-accent tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink">{item.title}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-10 lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
          <div className="border-t-[3px] border-navy-900 bg-paper p-6 sm:p-7">
            <p className="label">Итоговый документ</p>
            <h2 className="mt-3 text-[1.375rem] leading-snug">{service.result.title}</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{service.result.text}</p>
          </div>
          <div>
            <p className="label">Правовая основа</p>
            <dl className="mt-4 border-t border-line">
              {service.basis.map((item) => (
                <div key={item.code} className="border-b border-line py-4">
                  <dt className="font-medium text-ink">{item.code}</dt>
                  <dd className="mt-1 text-[0.875rem] leading-relaxed text-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      <section aria-labelledby="other-title" className="bg-paper">
        <div className="container-page py-16 lg:py-20">
          <div className="grid gap-6 border-t border-ink pt-6 lg:grid-cols-12 lg:gap-8">
            <h2 id="other-title" className="label lg:col-span-3">
              Другие направления
            </h2>
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:col-span-9">
              {others.map((item) => (
                <li key={item.slug} className="border-b border-line">
                  <Link href={`/uslugi/${item.slug}`} className="group block py-5">
                    <span className="block text-[1.125rem] font-semibold text-ink group-hover:underline group-hover:decoration-accent group-hover:underline-offset-[5px]">
                      {item.title}
                    </span>
                    <span className="mt-2 block text-[0.9375rem] leading-relaxed text-muted">{item.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaBand service={service.slug} />
    </>
  );
}
