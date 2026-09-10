import Link from "next/link";
import type { ToqueAberto } from "@/lib/outbound/toque-previo";
import { gerarToquesPreviosAction, registrarToqueAction } from "../crm-actions";
import { consoleHref } from "../data";
import { PendingPill } from "../pending";
import { Chip, MenuLinha, plural } from "../ui";

/**
 * Seção "Toque prévio no LinkedIn" do Hoje: uma fila de cliques. Cada linha é uma
 * pessoa que recebe E1 hoje ou no próximo dia de envio: abrir o perfil (nova aba),
 * mandar o convite sem mensagem, marcar "Convite enviado". Matéria da casa
 * (vidro da lente, eyebrow verde, superfície rebaixada), zero fio a mais.
 */

const BTN_BASE =
  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-(--duration-fast) ease-(--ease-out) " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98]";
const BTN_PRIMARY = `${BTN_BASE} bg-brand-soft text-brand-strong hover:bg-brand-soft-strong`;
const BTN_GHOST = `${BTN_BASE} text-foreground-muted hover:bg-[rgb(11_11_12/0.05)] hover:text-foreground`;
const ITEM_MENU =
  "block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-foreground transition-colors duration-(--duration-fast) hover:bg-background-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function iniciais(nome: string, sobrenome?: string): string {
  const a = nome.trim().charAt(0);
  const b = (sobrenome ?? "").trim().charAt(0) || nome.trim().split(/\s+/)[1]?.charAt(0) || "";
  return `${a}${b}`.toUpperCase();
}

export function ToquesPrevios({
  fila,
  feitosHoje,
  isDemo,
}: {
  fila: ToqueAberto[];
  feitosHoje: number;
  isDemo: boolean;
}) {
  const total = fila.length + feitosHoje;
  const pct = total === 0 ? 0 : Math.round((feitosHoje / total) * 100);
  // Chip da campanha só quando a fila mistura campanhas (nada repete 17 vezes).
  const campanhas = new Set(fila.map((t) => t.campaignSlug).filter(Boolean));
  const mostrarChip = campanhas.size > 1;

  return (
    <section aria-labelledby="toques-title" className="aqua-glass relative overflow-hidden rounded-3xl p-5 lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(40% 60% at 8% 0%, rgb(70 235 126 / 0.12), transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.58rem] font-bold tracking-[0.26em] text-brand-strong uppercase">
            Toque prévio · LinkedIn
          </p>
          <h2 id="toques-title" className="mt-1.5 font-display text-h4 font-bold text-foreground">
            Conectar antes do E1
            {total > 0 ? (
              <span className="ml-2 font-sans text-small font-medium text-foreground-subtle tabular-nums">
                {feitosHoje} de {total}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-foreground-muted">
            Um pedido de conexão sem mensagem, um dia antes do e-mail. Quem já viu seu rosto responde mais. Abra o
            perfil, conecte, marque feito. O resultado fica na conta da pessoa.
            {campanhas.size === 1 ? ` Hoje: ${[...campanhas][0]}.` : null}
          </p>
        </div>
        <form action={gerarToquesPreviosAction} className="shrink-0">
          {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
          <PendingPill className={BTN_GHOST} pendingLabel="Atualizando…">
            Atualizar lista
          </PendingPill>
        </form>
      </div>

      {total > 0 ? (
        <div
          className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-[rgb(11_11_12/0.06)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={feitosHoje}
          aria-label={`${plural(feitosHoje, "toque feito", "toques feitos")} de ${total}`}
        >
          <div
            className="h-full rounded-full bg-brand-strong shadow-[0_0_10px_rgb(70_235_126/0.45)] transition-[width] duration-500 ease-(--ease-out)"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {fila.length === 0 ? (
        <p className="relative mt-4 rounded-xl bg-white/55 px-4 py-5 text-center text-small text-foreground-muted">
          {feitosHoje > 0
            ? "Todos os toques de hoje feitos. Os próximos nascem no ciclo das 09:05."
            : "Nenhum toque pendente. A lista nasce no ciclo das 09:05 com os E1s de hoje e do próximo dia de envio."}
        </p>
      ) : (
        <ol className="relative mt-4 divide-y divide-[rgb(11_11_12/0.06)] overflow-hidden rounded-2xl bg-white/65 shadow-[0_14px_34px_-20px_rgb(11_11_12/0.4)]">
          {fila.map(({ task, contact, url, campaignSlug }) => {
            const nomeCompleto = [contact.nome, contact.sobrenome].filter(Boolean).join(" ");
            return (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-white/80 sm:grid sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <span
                  aria-hidden
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-[#052012]"
                  style={{
                    background: "linear-gradient(135deg, #46eb7e 0%, #bff5d1 100%)",
                    boxShadow: "0 0 12px rgb(70 235 126 / 0.3)",
                  }}
                >
                  {iniciais(contact.nome, contact.sobrenome)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link
                      href={consoleHref(`/interno/outbound/contatos/${contact.id}`, isDemo)}
                      className="min-w-0 truncate text-small font-semibold text-foreground underline-offset-2 hover:text-brand-strong hover:underline"
                      title={nomeCompleto}
                    >
                      {nomeCompleto}
                    </Link>
                    {mostrarChip && campaignSlug ? <Chip tone="neutral">{campaignSlug}</Chip> : null}
                  </span>
                  <span
                    className="min-w-0 truncate text-xs text-foreground-muted"
                    title={`${contact.cargo ?? ""} · ${contact.empresa ?? ""}`}
                  >
                    {[contact.cargo, contact.empresa].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 sm:justify-self-end">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
                      Abrir perfil
                      <span aria-hidden>↗</span>
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    <Chip tone="warning">sem perfil</Chip>
                  )}
                  <form action={registrarToqueAction} className="inline">
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="resultado" value={url ? "enviado" : "sem-perfil"} />
                    {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                    <PendingPill className={BTN_PRIMARY} pendingLabel="Marcando…">
                      {url ? "Convite enviado" : "Sem perfil"}
                    </PendingPill>
                  </form>
                  <MenuLinha rotulo={`Mais opções para ${nomeCompleto}`}>
                    <form action={registrarToqueAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="resultado" value="pulado" />
                      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                      <PendingPill className={ITEM_MENU} pendingLabel="Pulando…">
                        Pular este
                      </PendingPill>
                    </form>
                    <form action={registrarToqueAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="resultado" value="sem-perfil" />
                      {isDemo ? <input type="hidden" name="demo" value="1" /> : null}
                      <PendingPill className={ITEM_MENU} pendingLabel="Marcando…">
                        Perfil não encontrado
                      </PendingPill>
                    </form>
                  </MenuLinha>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
