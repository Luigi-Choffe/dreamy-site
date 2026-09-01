import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import type { SolutionAnchor } from "@/lib/outbound/types";
import { defaultWorkspaceSettings, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { FormComEstado } from "../form-com-estado";
import { SubmitButton } from "../pending";
import { ConsoleShell } from "../shell";
import { salvarConfiguracaoComEstado } from "../stateful-actions";
import { Quando } from "../ui";

/** Sempre dinâmico: lê o store (arquivos ou Postgres) a cada request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuração · outbound · interno",
  robots: { index: false, follow: false },
};

const ANCHORS: SolutionAnchor[] = ["nova-receita", "sistema", "agente-ia"];

const CONTROL =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-small text-foreground " +
  "hover:border-border-strong focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 focus:outline-none";
const LABEL = "text-xs font-semibold text-foreground";

/** Marca do workspace: o "isso pode ser seu" do piloto. Apresentação apenas. */
export default async function OutboundSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();

  const sp = await searchParams;
  const isDemo = demoRequested(sp);
  const data = await loadDashboardData(isDemo);

  const defaults = defaultWorkspaceSettings();
  const byAnchor = new Map(data.settings.ofertas.map((o) => [o.anchor, o]));
  const ofertas = ANCHORS.map((anchor) => byAnchor.get(anchor) ?? defaults.ofertas.find((o) => o.anchor === anchor)!);

  return (
    <ConsoleShell
      sessionEmail={session.email}
      active="configuracao"
      data={data}
      title="Configuração"
      subtitle="Marca e ofertas do workspace. Só apresentação: nada aqui toca copy, assinatura ou motor de envio."
    >
      <Card padding="md" className="max-w-2xl">
        {/* Erro inline preservando os 8 campos digitados; sucesso vira toast (P1 #5/#7). */}
        <FormComEstado action={salvarConfiguracaoComEstado} className="flex flex-col gap-5">
          {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="cfg-empresa" className={LABEL}>
                Nome da empresa (topo do console)
              </label>
              <input
                id="cfg-empresa"
                name="empresaNome"
                required
                defaultValue={data.settings.empresaNome}
                className={CONTROL}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cfg-operador" className={LABEL}>
                Operador <span className="font-normal text-foreground-subtle">(opcional)</span>
              </label>
              <input
                id="cfg-operador"
                name="operadorNome"
                defaultValue={data.settings.operadorNome ?? ""}
                className={CONTROL}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-4">
            <legend className="font-display text-h4 font-bold">As três ofertas</legend>
            {ofertas.map((oferta) => (
              <div key={oferta.anchor} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`cfg-${oferta.anchor}-titulo`} className={LABEL}>
                    Título ({oferta.anchor})
                  </label>
                  <input
                    id={`cfg-${oferta.anchor}-titulo`}
                    name={`oferta-${oferta.anchor}-titulo`}
                    required
                    defaultValue={oferta.titulo}
                    className={CONTROL}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`cfg-${oferta.anchor}-descricao`} className={LABEL}>
                    Descrição curta
                  </label>
                  <textarea
                    id={`cfg-${oferta.anchor}-descricao`}
                    name={`oferta-${oferta.anchor}-descricao`}
                    required
                    rows={2}
                    defaultValue={oferta.descricao}
                    className={`${CONTROL} resize-y`}
                  />
                </div>
              </div>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton size="sm" loadingLabel="Salvando">
              Salvar
            </SubmitButton>
            <p className="text-xs text-foreground-subtle tabular-nums">
              Última alteração: <Quando iso={data.settings.atualizadoEm} />
              {data.settings.atualizadoPor ? ` por ${data.settings.atualizadoPor}` : ""}
            </p>
          </div>
          <p className="border-t border-border pt-3 text-xs text-foreground-subtle">
            Estes campos existem para o piloto ser demonstrável com a marca de um cliente. A copy das campanhas, a
            assinatura dos e-mails e o motor de envio NÃO leem nada daqui (gates do ADR-020 continuam valendo).
          </p>
        </FormComEstado>
      </Card>
    </ConsoleShell>
  );
}
