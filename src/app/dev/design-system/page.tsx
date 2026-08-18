import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { HeroSystemDiagram } from "@/components/diagrams/HeroSystemDiagram";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Accordion } from "@/components/ui/Accordion";
import { Badge, Eyebrow } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { IS_PRODUCTION_SITE } from "@/config/env";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "Design System (interno) | Dreamy",
  description: "Página interna de revisão visual dos componentes.",
  path: "/dev/design-system",
  noIndex: true,
});

const colors = [
  ["background", "--background"],
  ["background-secondary", "--background-secondary"],
  ["surface", "--surface"],
  ["surface-hover", "--surface-hover"],
  ["foreground", "--foreground"],
  ["foreground-muted", "--foreground-muted"],
  ["foreground-subtle", "--foreground-subtle"],
  ["border", "--border"],
  ["border-strong", "--border-strong"],
  ["brand-primary", "--brand-primary"],
  ["brand-strong", "--brand-strong"],
  ["brand-soft", "--brand-soft"],
  ["success", "--success"],
  ["error", "--error"],
] as const;

function Swatches() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {colors.map(([name, v]) => (
        <li key={name} className="flex flex-col gap-2">
          <span className="h-14 rounded-md border border-border" style={{ background: `var(${v})` }} />
          <span className="text-xs text-foreground-muted">{name}</span>
        </li>
      ))}
    </ul>
  );
}

function ButtonsRow() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="inverse">Inverse</Button>
      <Button variant="link">Link</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
      <LinkButton href="#" size="sm" trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}>
        Small
      </LinkButton>
      <LinkButton href="#" size="lg" variant="secondary">
        Large
      </LinkButton>
    </div>
  );
}

/** Página interna temporária de revisão visual (PRD §97). Indisponível em produção. */
export default function DesignSystemPage() {
  if (IS_PRODUCTION_SITE) notFound();
  return (
    <>
      <section className="border-b border-border py-12">
        <Container>
          <Eyebrow>Interno · fora de produção</Eyebrow>
          <h1 className="mt-4 font-display text-h1 font-bold">Design System</h1>
          <p className="measure mt-4 text-lead text-foreground-muted">
            Tokens, tipografia e componentes com todos os estados. Cada bloco aparece nas superfícies clara e escura.
          </p>
        </Container>
      </section>

      <Section padding="compact" aria-labelledby="ds-type">
        <h2 id="ds-type" className="eyebrow mb-6">
          Tipografia
        </h2>
        <div className="flex flex-col gap-4">
          <p className="font-display text-display font-bold">Display — Tecnologia sob medida.</p>
          <p className="font-display text-h1 font-bold">H1 — Sua operação é única.</p>
          <p className="font-display text-h2 font-bold">H2 — Três formas de transformar tecnologia em resultado.</p>
          <p className="font-display text-h3 font-bold">H3 — Faça a IA executar trabalho real.</p>
          <p className="font-display text-h4 font-bold">H4 — Entender, desenhar, construir.</p>
          <p className="text-lead text-foreground-muted">
            Lead — Criamos novos produtos digitais, sistemas personalizados e agentes de IA.
          </p>
          <p className="text-body">Body — Começamos pelo problema. A tecnologia vem depois.</p>
          <p className="text-small text-foreground-muted">
            Small — Sem apresentação genérica. Vamos falar sobre o seu negócio.
          </p>
          <p className="eyebrow">Eyebrow — Software sob medida + IA</p>
        </div>
      </Section>

      {(["light", "dark"] as const).map((theme) => (
        <Section key={theme} theme={theme} padding="compact" divider aria-label={`Componentes — superfície ${theme}`}>
          <p className="eyebrow mb-6">Superfície {theme}</p>
          <div className="flex flex-col gap-10">
            <Swatches />
            <ButtonsRow />
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">brand</Badge>
              <Badge>neutral</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="success">success</Badge>
              <Badge variant="error">error</Badge>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field id={`${theme}-input`} label="Input" hint="Texto de ajuda" required>
                <Input id={`${theme}-input`} placeholder="Digite algo" />
              </Field>
              <Field id={`${theme}-input-error`} label="Input com erro" error="Mensagem de erro acessível." required>
                <Input id={`${theme}-input-error`} defaultValue="valor inválido" invalid />
              </Field>
              <Field id={`${theme}-select`} label="Select">
                <Select
                  id={`${theme}-select`}
                  placeholder="Selecione"
                  options={[
                    { value: "a", label: "Opção A" },
                    { value: "b", label: "Opção B" },
                  ]}
                  defaultValue=""
                />
              </Field>
              <Field id={`${theme}-textarea`} label="Textarea">
                <Textarea id={`${theme}-textarea`} placeholder="Descreva o contexto" rows={3} />
              </Field>
              <Checkbox id={`${theme}-check`} label="Checkbox com rótulo" />
              <Field id={`${theme}-disabled`} label="Input desabilitado">
                <Input id={`${theme}-disabled`} disabled defaultValue="desabilitado" />
              </Field>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <Card>
                <p className="font-display text-h4 font-bold">Card</p>
                <p className="mt-2 text-small text-foreground-muted">Superfície padrão com borda e sombra sutil.</p>
              </Card>
              <Card interactive>
                <p className="font-display text-h4 font-bold">Card interativo</p>
                <p className="mt-2 text-small text-foreground-muted">Hover eleva e reforça a borda.</p>
              </Card>
              <Card padding="sm" className="bg-background-secondary/60">
                <FlowDiagram
                  title="Fluxo"
                  steps={[{ label: "Dados" }, { label: "Sistema" }, { label: "Decisão" }]}
                  direction="vertical"
                  size="sm"
                  highlightLast
                />
              </Card>
            </div>
            <Accordion
              items={[
                { title: "Item de accordion 1", content: <p>Conteúdo do item 1.</p> },
                { title: "Item de accordion 2", content: <p>Conteúdo do item 2.</p> },
              ]}
            />
            <FlowDiagram
              title="Processo"
              steps={[
                { label: "Entender" },
                { label: "Desenhar" },
                { label: "Construir" },
                { label: "Colocar para trabalhar" },
                { label: "Evoluir" },
              ]}
              highlightLast
            />
          </div>
        </Section>
      ))}

      <Section padding="compact" divider aria-label="Diagrama do hero">
        <p className="eyebrow mb-6">Hero — diagrama de sistema</p>
        <div className="mx-auto max-w-xl">
          <HeroSystemDiagram title="Diagrama do hero" />
        </div>
      </Section>
    </>
  );
}
