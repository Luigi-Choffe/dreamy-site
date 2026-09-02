"use server";

import { registerReplyAction } from "./actions";
import { saveSettingsAction } from "./crm-actions";
import { createDemandAction } from "./demandas/actions";

/**
 * Wrappers com ESTADO das actions de formulário (P1 #5/#7 do plano de
 * melhorias): o try/catch roda NO SERVIDOR, então a mensagem real do erro de
 * validação volta no retorno (em produção, um throw de Server Action chega ao
 * cliente mascarado). A página exibe o erro inline SEM perder o que foi
 * digitado, e o sucesso vira toast. Erros de navegação (redirect) seguem
 * passando.
 */

export interface EstadoForm {
  ok?: string;
  error?: string;
  /** Carimbo para o cliente reagir a cada submissão (toast/reset). */
  ts: number;
}

function isNextControlFlow(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest: unknown }).digest).startsWith("NEXT_")
  );
}

async function executa(fn: () => Promise<void>, ok: string): Promise<EstadoForm> {
  try {
    await fn();
    return { ok, ts: Date.now() };
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    return {
      error: err instanceof Error ? err.message : "Não deu certo agora. Tente de novo.",
      ts: Date.now(),
    };
  }
}

export async function criarDemandaComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(() => createDemandAction(formData), "Demanda criada. O MORK vê a fila na hora.");
}

/**
 * Módulo de ajuste dos agentes (tela de gestão): o pedido do dono vira uma
 * DEMANDA na fila da cadeira certa — gate humano intacto: o MORK executa pela
 * CLI e presta contas; nada muda na configuração sem passar pela fila.
 */
export async function solicitarAjusteComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(async () => {
    const slug = formData.get("seat");
    const pedido = formData.get("pedido");
    if (typeof pedido !== "string" || pedido.trim() === "") throw new Error("Descreva o ajuste que você quer.");
    const { TEAM } = await import("@/lib/outbound/team");
    const seat = TEAM.find((s) => s.slug === slug && s.hired);
    if (!seat) throw new Error("Agente não encontrado.");
    const resumo = pedido.trim().replace(/\s+/g, " ");
    const composto = new FormData();
    composto.set(
      "title",
      `Ajuste no ${seat.nome}: ${resumo.length > 64 ? `${resumo.slice(0, 63).trimEnd()}…` : resumo}`,
    );
    composto.set("kind", seat.kinds[0] as string);
    composto.set("details", `${resumo}\n\n(Solicitação de ajuste do agente, feita na tela de gestão do time.)`);
    if (formData.get("demo") === "1") composto.set("demo", "1");
    await createDemandAction(composto);
  }, "Ajuste solicitado. Ele entrou na fila do agente e o MORK executa.");
}

export async function salvarConfiguracaoComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(() => saveSettingsAction(formData), "Configuração salva.");
}

export async function registrarRespostaComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(() => registerReplyAction(formData), "Resposta registrada.");
}
