import { LegacyHashRedirect } from "@/components/analytics/LegacyHashRedirect";
import { JsonLd } from "@/components/content/JsonLd";
import { CTASection } from "@/components/marketing/CTASection";
import { Hero } from "@/components/marketing/Hero";
import { CasesSection } from "@/components/marketing/home/CasesSection";
import { DiagnosisSection } from "@/components/marketing/home/DiagnosisSection";
import { FaqSection } from "@/components/marketing/home/FaqSection";
import { FitSection } from "@/components/marketing/home/FitSection";
import { ProblemSection } from "@/components/marketing/home/ProblemSection";
import { ProcessSection } from "@/components/marketing/home/ProcessSection";
import { ProofSection } from "@/components/marketing/home/ProofSection";
import { SolutionsSection } from "@/components/marketing/home/SolutionsSection";
import { homeContent } from "@/content/home";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "Dreamy | Software sob medida e Agentes de IA",
  description:
    "Criamos produtos digitais, sistemas personalizados e agentes de IA para empresas que querem aumentar receita e melhorar operações.",
  path: "/",
});

/**
 * Home (PRD §15–§26). Ritmo: hero → prova (condicional) → editorial → cards (dark) →
 * fluxo → cases (condicional) → etapas → fit (dark) → FAQ → CTA (dark).
 */
export default function HomePage() {
  const { finalCta } = homeContent;
  return (
    <>
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
      <LegacyHashRedirect />
      <Hero />
      <ProofSection />
      <ProblemSection />
      <SolutionsSection />
      <DiagnosisSection />
      <CasesSection />
      <ProcessSection />
      <FitSection />
      <FaqSection />
      <CTASection
        title={finalCta.title}
        text={finalCta.text}
        ctaLabel={finalCta.cta.label}
        ctaHref={finalCta.cta.href}
        ctaId="home_final_cta"
        ctaLocation="home_final"
        microcopy={finalCta.microcopy}
        id="cta-final-title"
      />
    </>
  );
}
