import Image from "next/image";
import { Section } from "@/components/layout/Section";
import { ProofMetric } from "@/components/marketing/ProofMetric";
import { Reveal } from "@/components/marketing/Reveal";
import { homeContent } from "@/content/home";
import { hasPublicProof, publicLogos, publicProofMetrics } from "@/content/proof";

/**
 * Home — Prova (PRD §17–§18). Renderiza SOMENTE com métricas verificadas e/ou logos autorizados.
 * Sem depoimentos, por regra. Enquanto não houver prova aprovada, a seção não existe.
 */
export function ProofSection() {
  if (!hasPublicProof) return null;
  return (
    <Section padding="compact" divider aria-labelledby="prova-title">
      <Reveal>
        <h2 id="prova-title" className="font-display text-h3 font-bold">
          {homeContent.proof.title}
        </h2>
      </Reveal>
      {publicProofMetrics.length > 0 ? (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {publicProofMetrics.map((m) => (
            <Reveal key={m.sourceRef}>
              <ProofMetric metric={m} />
            </Reveal>
          ))}
        </div>
      ) : null}
      {publicLogos.length > 0 ? (
        <ul className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-6" aria-label="Clientes">
          {publicLogos.map((logo) => (
            <li key={logo.sourceRef}>
              <Image
                src={logo.src}
                alt={logo.name}
                width={logo.width}
                height={logo.height}
                className="h-8 w-auto opacity-80 grayscale"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
