import { SITE_URL } from "@/config/env";
import { routes, siteConfig } from "@/config/site";
import { absoluteUrl } from "./metadata";

/**
 * Builders de structured data (PRD §49). Sem review/rating/estrelas — por regra.
 * Apenas dados existentes e configurados entram no JSON-LD.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationJsonLd() {
  const sameAs = [siteConfig.social.linkedin, siteConfig.social.instagram, siteConfig.social.youtube].filter(
    (v): v is string => Boolean(v),
  );
  const contactPoint = siteConfig.contact.whatsappNumber
    ? [
        {
          "@type": "ContactPoint",
          contactType: "sales",
          telephone: `+${siteConfig.contact.whatsappNumber}`,
          availableLanguage: ["Portuguese"],
          areaServed: "BR",
        },
      ]
    : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteConfig.name,
    ...(siteConfig.legalName ? { legalName: siteConfig.legalName } : {}),
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: absoluteUrl("/brand/dreamy-logo.png"), width: 927, height: 261 },
    description: siteConfig.description,
    ...(sameAs.length ? { sameAs } : {}),
    ...(contactPoint ? { contactPoint } : {}),
    ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: siteConfig.name,
    inLanguage: "pt-BR",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function serviceJsonLd(input: { name: string; description: string; path: string; serviceType: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    serviceType: input.serviceType,
    description: input.description,
    url: absoluteUrl(input.path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: "Brasil" },
    availableLanguage: "pt-BR",
  };
}

/** Bylines institucionais ("Equipe Dreamy", "Dreamy") apontam para a Organization. */
export function isOrganizationAuthor(author: string): boolean {
  const a = author.trim().toLowerCase();
  return (
    a === siteConfig.name.toLowerCase() ||
    a === `equipe ${siteConfig.name.toLowerCase()}` ||
    a === `time ${siteConfig.name.toLowerCase()}`
  );
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntityOfPage: absoluteUrl(input.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: isOrganizationAuthor(input.author) ? { "@id": ORGANIZATION_ID } : { "@type": "Person", name: input.author },
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "pt-BR",
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
  };
}

export const homeBreadcrumb: BreadcrumbItem = { name: "Início", path: routes.home };
