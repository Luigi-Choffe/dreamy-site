import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { requireSession } from "@/lib/outbound/auth";
import type { SolutionAnchor } from "@/lib/outbound/types";
import { defaultWorkspaceSettings, demoRequested, loadDashboardData, type SearchParams } from "../data";
import { FormComEstado } from "../form-com-estado";
import { SubmitButton } from "../pending";
import { ConsoleShell } from "../shell";
import { salvarConfiguracaoComEstado } from "../stateful-actions";
import { ANCHOR_LABELS, Quando } from "../ui";

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
      {/* R11: fim do cartão estreito num vão vazio — marca em cima, as três
          ofertas lado a lado em cartões próprios, labels humanas (sem slug). */}
      <FormComEstado action={salvarConfiguracaoComEstado} className="flex flex-col gap-6">
        {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
        <Card as="section" padding="sm" aria-label="Marca do workspace">
          <h2 className="font-display text-h4 font-bold">Marca</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </Card>

        <fieldset>
          <legend className="font-display text-h4 font-bold">As três ofertas</legend>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {ofertas.map((oferta) => (
              <Card
                key={oferta.anchor}
                padding="sm"
                className="border-t-2 border-t-brand/40"
                aria-label={`Oferta ${ANCHOR_LABELS[oferta.anchor]}`}
              >
                <p className="text-[0.62rem] font-bold tracking-[0.22em] text-foreground-subtle uppercase">
                  Oferta · {ANCHOR_LABELS[oferta.anchor]}
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`cfg-${oferta.anchor}-titulo`} className={LABEL}>
                      Título
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
                      rows={3}
                      defaultValue={oferta.descricao}
                      className={`${CONTROL} resize-y`}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
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
        <p className="max-w-3xl border-t border-border pt-3 text-xs text-foreground-subtle">
          Estes campos existem para o piloto ser demonstrável com a marca de um cliente. A copy das campanhas, a
          assinatura dos e-mails e o motor de envio NÃO leem nada daqui (gates do ADR-020 continuam valendo).
        </p>
      </FormComEstado>
    </ConsoleShell>
  );
}
