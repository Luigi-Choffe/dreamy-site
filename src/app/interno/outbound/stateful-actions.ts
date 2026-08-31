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

export async function salvarConfiguracaoComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(() => saveSettingsAction(formData), "Configuração salva.");
}

export async function registrarRespostaComEstado(_prev: EstadoForm | null, formData: FormData): Promise<EstadoForm> {
  return executa(() => registerReplyAction(formData), "Resposta registrada.");
}
