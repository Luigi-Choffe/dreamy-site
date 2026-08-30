import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/observability/logger";
import { aiAvailable, suggestReplyTriage, type TriageSuggestion } from "@/lib/outbound/ai";
import { logAgentActivity } from "@/lib/outbound/agent-log";
import { getSession } from "@/lib/outbound/auth";
import { openStore, runExclusive } from "@/lib/outbound/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outbound/sugestao-resposta — sugere classe + resumo + rascunho para
 * uma resposta recebida. GATE HUMANO SEMPRE: nada é gravado nem enviado por aqui;
 * a classificação continua nas actions/CLI e o envio é manual pela caixa.
 * Prompt sem PII: e-mails são redigidos e só vão primeiro nome, cargo e indústria.
 */

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return json(401, { ok: false, code: "unauthorized" });

  const body = (await request.json().catch(() => null)) as {
    texto?: string;
    contactId?: string;
    replyId?: string;
    demo?: boolean;
  } | null;
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (texto.length < 5) {
    return json(400, { ok: false, code: "sem_texto", error: "Cole o texto da resposta para a IA analisar." });
  }
  const isDemo = body?.demo === true;

  if (isDemo) {
    const suggestion: TriageSuggestion = {
      classe: "interested",
      resumo: "Exemplo de demonstração: a pessoa achou relevante e topa uma conversa curta.",
      rascunho:
        "Que bom que fez sentido. Em 20 minutos te mostro como isso funcionaria na sua operação, sem enrolação. Quinta 10h ou sexta 9h, qual encaixa melhor?",
    };
    return json(200, { ok: true, suggestion, demo: true });
  }

  if (!aiAvailable()) {
    return json(503, {
      ok: false,
      code: "sem_chave",
      error: "Defina OUTBOUND_ANTHROPIC_API_KEY ou OUTBOUND_OPENAI_API_KEY para ligar a sugestão de triagem.",
    });
  }

  const store = openStore();
  let primeiroNome: string | undefined;
  let cargo: string | undefined;
  let industria: string | undefined;
  if (body?.contactId) {
    const contacts = await store.contacts();
    const contact = contacts.find((c) => c.id === body.contactId);
    primeiroNome = contact?.nome;
    cargo = contact?.cargo;
    industria = contact?.industria;
  }

  let suggestion: TriageSuggestion;
  try {
    suggestion = await suggestReplyTriage({ texto, primeiroNome, cargo, industria });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar a sugestão.";
    logger.warn("outbound.ai.sugestao_falhou", { message });
    return json(502, { ok: false, code: "ia_falhou", error: message });
  }

  await runExclusive("sugestao-log", async () => {
    await logAgentActivity(store, {
      actor: "console",
      kind: "sugestao",
      summary: `Sugestão de triagem gerada (classe sugerida: ${suggestion.classe}).`,
      refs: { replyId: body?.replyId, contactId: body?.contactId },
    });
  });
  logger.info("outbound.ai.sugestao", { classe: suggestion.classe });
  return json(200, { ok: true, suggestion });
}
