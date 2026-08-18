import { Suspense } from "react";
import { Check, MessageCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { LeadForm } from "@/components/forms/LeadForm";
import { Container } from "@/components/layout/Container";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Eyebrow } from "@/components/ui/Badge";
import { routes, whatsappUrl } from "@/config/site";
import { contactContent } from "@/content/contact";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: contactContent.seo.title,
  description: contactContent.seo.description,
  path: routes.contact,
});

/** /contato (PRD §34): página estática; o formulário é client e lê ?solucao= via Suspense. */
export default function ContactPage() {
  const wa = whatsappUrl();
  return (
    <section className="pt-8 pb-20 md:pt-10 md:pb-28">
      <Container>
        <Breadcrumbs items={[{ name: "Contato", path: routes.contact }]} />
        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-5">
              <Eyebrow>{contactContent.eyebrow}</Eyebrow>
              <h1 className="font-display text-h1 font-bold text-balance">{contactContent.title}</h1>
              <p className="measure text-lead text-foreground-muted">{contactContent.intro}</p>
            </div>
            <aside
              className="mt-10 rounded-xl border border-border bg-background-secondary/70 p-6"
              aria-labelledby="contact-aside-title"
            >
              <h2 id="contact-aside-title" className="font-display text-h4 font-bold">
                {contactContent.aside.title}
              </h2>
              <ol className="mt-4 flex flex-col gap-3">
                {contactContent.aside.items.map((item, i) => (
                  <li key={item} className="flex items-start gap-3 text-small text-foreground-muted">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"
                    >
                      {i < 2 ? (
                        <span className="text-[0.65rem] font-bold">{i + 1}</span>
                      ) : (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
              {wa ? (
                <div className="mt-6 border-t border-border pt-5">
                  <p className="text-small font-semibold text-foreground">{contactContent.aside.whatsappLabel}</p>
                  <div className="mt-3">
                    <CtaLink
                      href={wa}
                      external
                      variant="secondary"
                      size="sm"
                      ctaId="contact_whatsapp"
                      ctaLocation="contact_aside"
                      intent="whatsapp"
                      leadingIcon={<MessageCircle className="size-4" aria-hidden="true" />}
                    >
                      {contactContent.aside.whatsappCta}
                    </CtaLink>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
          <div className="lg:col-span-7">
            <Suspense
              fallback={<div className="min-h-[32rem] rounded-2xl border border-border bg-surface" aria-busy="true" />}
            >
              <LeadForm />
            </Suspense>
          </div>
        </div>
      </Container>
    </section>
  );
}
