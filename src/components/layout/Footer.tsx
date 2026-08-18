import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { FooterCtaLink } from "@/components/layout/FooterCtaLink";
import { buildNavigation, type NavItem } from "@/config/navigation";
import { routes, siteConfig, whatsappUrl } from "@/config/site";
import { getContentFlags } from "@/lib/content/collections";

function FooterColumn({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h2 className="mb-4 font-sans text-xs font-semibold tracking-(--tracking-eyebrow) text-foreground-subtle uppercase">
        {title}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-small text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Footer (Server Component) — tema escuro, dados institucionais somente se configurados. */
export function Footer() {
  const nav = buildNavigation(getContentFlags());
  const wa = whatsappUrl();
  const year = new Date().getFullYear();
  const start = siteConfig.copyrightStartYear;
  const yearLabel = start && start < year ? `${start}–${year}` : `${year}`;

  return (
    <footer data-theme="dark" className="border-t border-border bg-background text-foreground">
      <div className="container-x py-14 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="max-w-sm">
            <Logo onDark width={132} />
            <p className="mt-5 text-small text-foreground-muted">
              Software sob medida e agentes de IA para empresas que precisam de tecnologia construída em torno do
              negócio.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-small">
              <FooterCtaLink href={routes.contact} ctaId="footer_contact" intent="contact">
                Conversar com a Dreamy
              </FooterCtaLink>
              {wa ? (
                <FooterCtaLink href={wa} ctaId="footer_whatsapp" intent="whatsapp" external>
                  WhatsApp comercial
                </FooterCtaLink>
              ) : null}
              {siteConfig.contact.email ? (
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-foreground-muted transition-colors hover:text-foreground"
                >
                  {siteConfig.contact.email}
                </a>
              ) : null}
              {siteConfig.social.linkedin ? (
                <a
                  href={siteConfig.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground-muted transition-colors hover:text-foreground"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
          <FooterColumn title="Soluções" items={nav.footer.solutions} />
          <FooterColumn title="Empresa" items={nav.footer.company} />
          <div>
            <FooterColumn title="Legal" items={nav.footer.legal} />
            <div className="mt-2.5">
              <CookiePreferencesLink className="text-small text-foreground-muted transition-colors hover:text-foreground" />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-foreground-subtle md:flex-row md:items-center md:justify-between">
          <p>
            © {yearLabel} {siteConfig.legalName ?? siteConfig.name}
            {siteConfig.cnpj ? ` · CNPJ ${siteConfig.cnpj}` : ""}
            {siteConfig.contact.address ? ` · ${siteConfig.contact.address}` : ""}
          </p>
          <p>Começamos pelo problema. A tecnologia vem depois.</p>
        </div>
      </div>
    </footer>
  );
}
