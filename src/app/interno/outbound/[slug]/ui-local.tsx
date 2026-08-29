import type { ReactNode } from "react";
import { lintEmail, renderTemplate } from "@/lib/outbound/render";
import { SIGNATURE_TEXT } from "@/lib/outbound/signature";
import type { CampaignStep } from "@/lib/outbound/types";
import { cn } from "@/lib/utils/cn";
import { Chip, fmtInt } from "../ui";

/**
 * Componentes locais do detalhe de campanha — em especial a PRÉVIA DA COPY:
 * o e-mail renderizado como o prospect verá, com lint e variáveis pendentes
 * sempre à vista (nunca esconder problema de copy — PRD outbound §6).
 */

/** Amostra de personalização da prévia (mesmo espírito do approve da CLI). */
export const SAMPLE_CONTACT = {
  nome: "Maria",
  empresa: "Acme Distribuidora",
  cargo: "CEO",
} as const;

/** Badge de lint que quebra linha (detalhes longos não podem sumir na borda). */
function LintBadge({ tone, title, children }: { tone: "error" | "warn"; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-baseline gap-1 rounded-md px-2 py-1 text-xs font-medium",
        tone === "error" ? "bg-error-soft text-error" : "border border-warning/50 text-warning",
      )}
    >
      {children}
    </span>
  );
}

export interface StepCopyPreviewProps {
  step: CampaignStep;
  /** e1 é "dia 0"; os demais mostram o offset relativo ao passo anterior. */
  isFirst: boolean;
  /** Indústria da campanha — entra como variável de amostra. */
  industria: string;
  /** Amostras das variáveis custom da campanha (def.sampleCustom — ex.: abertura). */
  sampleCustom?: Record<string, string>;
}

/**
 * Prévia de um passo: assunto + corpo renderizados com a amostra, contagem de
 * palavras e badges de lint (erros em vermelho, avisos em âmbar). Variável sem
 * valor na amostra ganha badge "usa coluna do Clay" — o buraco fica declarado.
 */
export function StepCopyPreview({ step, isFirst, industria, sampleCustom }: StepCopyPreviewProps) {
  const vars: Record<string, string> = { ...sampleCustom, ...SAMPLE_CONTACT, industria };
  const subject = renderTemplate(step.subject, vars);
  const body = renderTemplate(step.body, vars);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  const issues = lintEmail(subject.value, body.value, { subjectTemplate: step.subject });
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const words = body.value.split(/\s+/).filter(Boolean).length;
  const clean = missing.length === 0 && issues.length === 0;

  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <h3 className="font-display text-small font-bold uppercase">{step.id}</h3>
        <Chip tone="outline" title={isFirst ? "primeiro envio da cadência" : "dias após o passo anterior"}>
          {isFirst ? "dia 0" : `+${step.offsetDays}d`}
        </Chip>
        <Chip tone={step.withLink ? "brand" : "outline"}>{step.withLink ? "com link" : "sem link"}</Chip>
        <span className="ml-auto text-xs text-foreground-subtle tabular-nums">{fmtInt(words)} palavras</span>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-border bg-background-secondary/40 px-4 py-2">
        {clean ? <Chip tone="success">lint ok</Chip> : null}
        {missing.map((name) => (
          <LintBadge
            key={`missing-${name}`}
            tone="warn"
            title="Sem valor na amostra — o envio real exige esta coluna preenchida para todo contato inscrito."
          >
            {`usa coluna do Clay: {{${name}}}`}
          </LintBadge>
        ))}
        {errors.map((issue, i) => (
          <LintBadge key={`error-${i}`} tone="error">
            {issue.rule}: {issue.detail}
          </LintBadge>
        ))}
        {warns.map((issue, i) => (
          <LintBadge key={`warn-${i}`} tone="warn">
            {issue.rule}: {issue.detail}
          </LintBadge>
        ))}
      </div>

      <div className="px-4 py-3">
        <p className="text-small">
          <span className="text-foreground-subtle">Assunto:</span>{" "}
          <span className="font-semibold text-foreground">{subject.value}</span>
        </p>
        <div className="mt-3 text-small leading-relaxed break-words whitespace-pre-wrap text-foreground">{body.value}</div>
        {/* Assinatura anexada pelo motor em todo envio (src/lib/outbound/signature.ts) */}
        <div className="mt-4 border-t border-border pt-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground-muted">
          {SIGNATURE_TEXT}
        </div>
      </div>
    </article>
  );
}
