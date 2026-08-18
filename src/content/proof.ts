/**
 * Prova (PRD §17–§18): SOMENTE dados verificáveis e aprovados.
 *
 * Cada item precisa de `sourceRef` correspondente a uma entrada em
 * docs/CONTENT-SOURCES.md com "Approved for public website: yes".
 * Itens com verified/authorized = false nunca são renderizados nem entram no build público.
 *
 * Estado atual: nenhum indicador verificado e nenhum logo autorizado
 * (ver docs/CONTENT-SOURCES.md). A seção de prova da Home permanece oculta.
 */

export interface ProofMetric {
  /** Valor exibido, ex.: "70.000" */
  value: string;
  /** Rótulo, ex.: "requisições processadas por mês" */
  label: string;
  /** Prefixo/sufixo opcionais, ex.: "+" */
  prefix?: string;
  suffix?: string;
  verified: boolean;
  sourceRef: string;
}

export interface AuthorizedLogo {
  name: string;
  /** Caminho em /public/brand/clients/ */
  src: string;
  width: number;
  height: number;
  authorized: boolean;
  sourceRef: string;
}

export const proofMetrics: ProofMetric[] = [];

export const authorizedLogos: AuthorizedLogo[] = [];

export const publicProofMetrics = proofMetrics.filter((m) => m.verified && m.sourceRef);
export const publicLogos = authorizedLogos.filter((l) => l.authorized && l.sourceRef);

export const hasPublicProof = publicProofMetrics.length > 0 || publicLogos.length > 0;
