"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { DEAL_STAGES } from "@/lib/outbound/crm-core";
import type { DealStage } from "@/lib/outbound/types";
import { moveDealStageAction } from "../crm-actions";
import { Chip, DEAL_STAGE_LABELS, DEAL_STAGE_TONES, fmtBRL, fmtInt } from "../ui";

/**
 * KANBAN do pipeline: drag and drop nativo (HTML5) + fallback acessível
 * ("Mover" por formulário, teclado e touch). As regras do domínio
 * (applyStageMove) são espelhadas ANTES do drop: coluna abaixo do piso do
 * outbound fica inválida durante o arrasto; "perdido" pede motivo e
 * "reunião marcada" pede data num diálogo. O cartão move na hora
 * (useOptimistic) e reverte sozinho se o servidor recusar.
 * PII: e-mail do contato só em tooltip, nunca texto visível.
 */

export interface BoardDeal {
  id: string;
  stage: DealStage;
  /** Piso do outbound resolvido no servidor (autoStage ?? "novo"). */
  floor: DealStage;
  empresa: string;
  nome: string;
  cargo?: string;
  /** Apenas para tooltip (PII). */
  email?: string;
  campaignSlug?: string;
  valorEstimado?: number;
  reuniaoEm?: string;
  lostReason?: string;
  /** Calculado no servidor (evita divergência de hidratação). */
  diasNoEstagio: number;
}

const ORDER = new Map(DEAL_STAGES.map((s, i) => [s, i]));
const COL_WIDTH = "w-[17.5rem]";

const reuniaoFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function canDrop(deal: BoardDeal, to: DealStage): boolean {
  return to !== deal.stage && (ORDER.get(to) ?? 0) >= (ORDER.get(deal.floor) ?? 0);
}

/** O que falta para completar o movimento (abre diálogo antes de commitar). */
function needsDialog(deal: BoardDeal, to: DealStage): "motivo" | "reuniao" | null {
  if (to === "perdido") return "motivo";
  if (to === "reuniao_marcada" && !deal.reuniaoEm) return "reuniao";
  return null;
}

export function PipelineBoard({ deals, isDemo }: { deals: BoardDeal[]; isDemo: boolean }) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    deals,
    (state, move: { id: string; to: DealStage; reuniaoEm?: string; lostReason?: string }) =>
      state.map((d) =>
        d.id === move.id
          ? {
              ...d,
              stage: move.to,
              diasNoEstagio: 0,
              reuniaoEm: move.reuniaoEm ?? d.reuniaoEm,
              lostReason: move.lostReason ?? d.lostReason,
            }
          : d,
      ),
  );
  /** Negócio em arrasto (para esmaecer colunas inválidas). */
  const [dragging, setDragging] = useState<BoardDeal | null>(null);
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null);
  /** Movimento aguardando motivo/data no diálogo. */
  const [pending, setPending] = useState<{ deal: BoardDeal; to: DealStage; ask: "motivo" | "reuniao" } | null>(null);
  const dialogInputRef = useRef<HTMLElement | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<DealStage, BoardDeal[]>(DEAL_STAGES.map((s) => [s, []]));
    for (const deal of optimistic) map.get(deal.stage)?.push(deal);
    return map;
  }, [optimistic]);

  function commitMove(deal: BoardDeal, to: DealStage, extra?: { motivo?: string; reuniaoEm?: string }) {
    startTransition(async () => {
      applyOptimistic({ id: deal.id, to, reuniaoEm: extra?.reuniaoEm, lostReason: extra?.motivo });
      const fd = new FormData();
      fd.set("dealId", deal.id);
      fd.set("stage", to);
      if (extra?.motivo) fd.set("motivo", extra.motivo);
      if (extra?.reuniaoEm) fd.set("reuniaoEm", extra.reuniaoEm);
      if (isDemo) fd.set("demo", "1");
      try {
        await moveDealStageAction(fd);
        toast({ variant: "success", title: `${deal.empresa} agora está em "${DEAL_STAGE_LABELS[to]}".` });
      } catch {
        // O cartão volta sozinho (useOptimistic) quando a action falha.
        toast({
          variant: "error",
          title: "Não deu para mover o negócio.",
          description: "Tente de novo em instantes. Um comando do MORK pode estar com o store aberto.",
        });
      }
    });
  }

  function requestMove(deal: BoardDeal, to: DealStage) {
    if (to === deal.stage) return;
    if (!canDrop(deal, to)) {
      toast({
        variant: "error",
        title: "O outbound não deixa voltar.",
        description: `O motor já registrou "${DEAL_STAGE_LABELS[deal.floor]}" para este contato.`,
      });
      return;
    }
    const ask = needsDialog(deal, to);
    if (ask) {
      setPending({ deal, to, ask });
      return;
    }
    commitMove(deal, to);
  }

  function confirmDialog(formData: FormData) {
    if (!pending) return;
    const motivo = String(formData.get("motivo") ?? "").trim();
    const reuniaoEm = String(formData.get("reuniaoEm") ?? "").trim();
    const { deal, to, ask } = pending;
    setPending(null);
    if (ask === "motivo") commitMove(deal, to, { motivo });
    else commitMove(deal, to, { reuniaoEm });
  }

  return (
    <div className="relative">
      {/* Fades nas bordas: sinal honesto de que há mais funil para os lados. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6"
        style={{ background: "linear-gradient(90deg, var(--background), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6"
        style={{ background: "linear-gradient(270deg, var(--background), transparent)" }}
      />

      <div
        tabIndex={0}
        role="region"
        aria-label="Pipeline de negócios"
        className="snap-x snap-proximity overflow-x-auto pb-2"
      >
        <div className="flex gap-3">
          {DEAL_STAGES.map((stage) => {
            const list = byStage.get(stage) ?? [];
            const total = list.reduce((sum, d) => sum + (d.valorEstimado ?? 0), 0);
            const invalida = dragging ? !canDrop(dragging, stage) : false;
            const isTarget = dropTarget === stage && dragging !== null && !invalida;
            return (
              <section
                key={stage}
                aria-label={DEAL_STAGE_LABELS[stage]}
                onDragOver={(e) => {
                  if (!dragging || invalida) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(stage);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTarget((t) => (t === stage ? null : t));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  if (dragging) requestMove(dragging, stage);
                }}
                className={`flex min-h-[16rem] ${COL_WIDTH} shrink-0 snap-start flex-col gap-2 rounded-xl p-2 transition-[background-color,box-shadow,opacity] duration-(--duration-fast) ${
                  isTarget
                    ? "bg-brand-soft/70 shadow-[inset_0_0_0_1.5px_var(--brand-primary)]"
                    : "bg-background-secondary/50"
                } ${invalida ? "opacity-40" : ""}`}
              >
                <header className="flex items-baseline justify-between gap-2 border-b border-border px-1 pb-2">
                  <span className="flex items-center gap-2">
                    <Chip tone={DEAL_STAGE_TONES[stage]}>{DEAL_STAGE_LABELS[stage]}</Chip>
                    <span className="text-xs font-semibold text-foreground tabular-nums">{fmtInt(list.length)}</span>
                  </span>
                  {total > 0 ? (
                    <span className="text-xs font-semibold whitespace-nowrap text-foreground-muted tabular-nums">
                      {fmtBRL(total)}
                    </span>
                  ) : null}
                </header>

                <div className="flex flex-1 flex-col gap-2">
                  {list.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onDragStart={() => setDragging(deal)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      onMove={(to) => requestMove(deal, to)}
                    />
                  ))}
                  {list.length === 0 ? (
                    <p
                      className={`grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-6 text-center text-xs ${
                        isTarget
                          ? "border-brand-strong/60 font-semibold text-brand-strong"
                          : "border-border-strong/60 text-foreground-subtle"
                      }`}
                    >
                      {dragging && !invalida ? "solte aqui" : "vazio"}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Diálogos de regra de domínio: motivo do perdido / data da reunião. */}
      <Dialog
        open={pending?.ask === "motivo"}
        onClose={() => setPending(null)}
        title="Por que perdemos?"
        description={pending ? `${pending.deal.empresa} sai do funil com o motivo registrado no histórico.` : undefined}
        initialFocusRef={dialogInputRef as React.RefObject<HTMLElement>}
      >
        <form action={confirmDialog} className="flex flex-col gap-4">
          <Field id="perdido-motivo" label="Motivo" required>
            <Textarea
              id="perdido-motivo"
              name="motivo"
              rows={3}
              required
              ref={dialogInputRef as React.RefObject<HTMLTextAreaElement>}
              placeholder="ex.: fechou com o fornecedor atual; sem orçamento neste ano"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="border-error/50 text-error hover:bg-error-soft"
            >
              Mover para perdido
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={pending?.ask === "reuniao"}
        onClose={() => setPending(null)}
        title="Quando é a reunião?"
        description={pending ? `${pending.deal.empresa} entra em "reunião marcada" com data e hora.` : undefined}
        initialFocusRef={dialogInputRef as React.RefObject<HTMLElement>}
      >
        <form action={confirmDialog} className="flex flex-col gap-4">
          <Field id="reuniao-quando" label="Data e hora" required>
            <Input
              id="reuniao-quando"
              name="reuniaoEm"
              type="datetime-local"
              required
              ref={dialogInputRef as React.RefObject<HTMLInputElement>}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm">
              Marcar reunião
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DealCard({
  deal,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  deal: BoardDeal;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: DealStage) => void;
}) {
  const destinos = DEAL_STAGES.filter((s) => canDrop(deal, s));
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`relative flex cursor-grab flex-col gap-2 overflow-hidden rounded-xl border bg-surface p-3 shadow-sm transition-[box-shadow,transform] duration-(--duration-fast) ease-(--ease-out) select-none hover:shadow-md active:cursor-grabbing motion-safe:hover:-translate-y-px ${
        deal.stage === "ganho" ? "border-brand-soft-strong" : "border-border"
      }`}
    >
      {/* Vitória merece o verde: fio no topo do card ganho. */}
      {deal.stage === "ganho" ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand" /> : null}
      {/* PII: e-mail só em tooltip, nunca como texto visível. */}
      <div className="min-w-0" title={deal.email}>
        <p className="truncate text-small font-semibold text-foreground">{deal.empresa}</p>
        <p className="truncate text-xs text-foreground-muted">
          {deal.nome}
          {deal.cargo ? <span className="text-foreground-subtle"> · {deal.cargo}</span> : null}
        </p>
      </div>
      <p className="text-xs text-foreground-subtle tabular-nums">
        {deal.campaignSlug ?? "manual"} · {fmtInt(deal.diasNoEstagio)}d no estágio
        {deal.valorEstimado ? ` · ${fmtBRL(deal.valorEstimado)}` : ""}
      </p>
      {deal.stage === "reuniao_marcada" && deal.reuniaoEm ? (
        <p className="text-xs font-semibold text-success tabular-nums">
          reunião {reuniaoFmt.format(new Date(deal.reuniaoEm))}
        </p>
      ) : null}
      {deal.stage === "perdido" && deal.lostReason ? (
        <p className="text-xs text-foreground-subtle">motivo: {deal.lostReason}</p>
      ) : null}

      {/* Fallback acessível do drag and drop: teclado, leitores de tela e touch. */}
      {destinos.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:text-foreground">
            Mover para…
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {destinos.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => onMove(stage)}
                className="rounded-full bg-background-secondary px-2.5 py-1 font-semibold text-foreground-muted transition-colors duration-(--duration-fast) hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98]"
              >
                {DEAL_STAGE_LABELS[stage]}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}
