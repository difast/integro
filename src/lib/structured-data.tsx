import type { Crumb } from "@/components/layout/PageHeader";
import { company } from "@/config/company";
import { services } from "@/config/services";
import { absoluteUrl } from "@/lib/site";

/** Organization — только сведения из реквизитов и контактов компании (src/config/company.ts). */
export function organizationJsonLd(): Record<string, unknown> | null {
  const url = absoluteUrl("/");
  if (!url) return null;
  const { contacts, requisites } = company;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.legalName,
    legalName: company.fullLegalName,
    url,
    logo: absoluteUrl("/icon.png"),
    description: `${company.tagline}: ${services.map((s) => s.title.toLowerCase()).join(", ")}.`,
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(contacts.email ? { email: contacts.email } : {}),
    taxID: requisites.inn,
    identifier: { "@type": "PropertyValue", propertyID: "ОГРН", value: requisites.ogrn },
    address: { "@type": "PostalAddress", streetAddress: requisites.legalAddress, addressLocality: "Москва", addressCountry: "RU" },
    areaServed: "RU",
  };
}

/**
 * BreadcrumbList для страницы — повторяет видимую навигационную цепочку.
 * Без основного домена (absoluteUrl → null) разметка не выводится.
 */
export function breadcrumbJsonLd(crumbs: Crumb[], currentPath: string): Record<string, unknown> | null {
  const items = [{ label: "Главная", href: "/" }, ...crumbs];
  const elements = items.map((crumb, index) => {
    const href = crumb.href ?? (index === items.length - 1 ? currentPath : undefined);
    const url = href ? absoluteUrl(href) : null;
    return url ? { "@type": "ListItem", position: index + 1, name: crumb.label, item: url } : null;
  });
  if (elements.some((element) => element === null)) return null;
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: elements };
}

export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  // JSON.stringify не экранирует «</script>»; заменяем «<» на безопасную последовательность.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
