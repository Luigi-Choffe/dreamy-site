/**
 * Salvaguardas das falhas registradas em docs/FALHAS-E-SALVAGUARDAS.md (caça de
 * 2026-09-10). Cada bloco trava uma falha para ela não voltar:
 *   #5 cadência por data-calendário · #4 feriados nacionais ·
 *   #10 alerta de campanha bloqueada por aprovação · #9 frase dos colegas no envio.
 */
import { describe, expect, it } from "vitest";
import { validacaoIndicacao } from "@/content/outbound/validacao-indicacao";
import { colegasNoPlano, contatoParaEnvio, fraseColegas, FRASE_SOLO, listaNomes } from "@/lib/outbound/colegas";
import { addDaysToDateKey, cadenceDue } from "@/lib/outbound/config";
import { bloqueiosDeAprovacao } from "@/lib/outbound/engine";
import { feriadoNacional, FERIADOS_NACIONAIS } from "@/lib/outbound/feriados";
import { campaignContentHash } from "@/lib/outbound/render";
import type { CampaignRuntime, Contact, Enrollment, PlanItem } from "@/lib/outbound/types";

const SP = "-03:00";

describe("#5 cadência por data-calendário (follow-up não atrasa um dia)", () => {
  it("E2 enviado na tarde de sexta 04/09 (+3d) vence no ciclo de segunda 07/09 às 09:05", () => {
    const lastSendAt = "2026-09-04T20:17:00.000Z"; // 17:17 em São Paulo
    expect(cadenceDue(lastSendAt, 3, new Date("2026-09-07T12:05:00.000Z"), SP)).toBe(true);
  });
  it("não vence antes da data (domingo 06/09)", () => {
    expect(cadenceDue("2026-09-04T20:17:00.000Z", 3, new Date("2026-09-06T12:05:00.000Z"), SP)).toBe(false);
  });
  it("a hora do envio não conta: enviado 23:59 local ainda conta como o dia do envio", () => {
    const lastSendAt = "2026-09-05T02:59:00.000Z"; // 23:59 de 04/09 em São Paulo
    expect(cadenceDue(lastSendAt, 3, new Date("2026-09-07T12:05:00.000Z"), SP)).toBe(true);
    expect(addDaysToDateKey("2026-09-04", 3)).toBe("2026-09-07");
    expect(addDaysToDateKey("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("#4 feriados nacionais bloqueiam a janela", () => {
  it("07/09/2026 é feriado; 08/09/2026 não; 25/12/2026 é", () => {
    expect(feriadoNacional("2026-09-07")).toMatch(/Independência/);
    expect(feriadoNacional("2026-09-08")).toBeNull();
    expect(feriadoNacional("2026-12-25")).toBe("Natal");
  });
  it("a tabela cobre 2026 e 2027 com as datas móveis certas (Páscoa 05/04/2026 e 28/03/2027)", () => {
    expect(FERIADOS_NACIONAIS["2026-04-03"]).toMatch(/Santa/);
    expect(FERIADOS_NACIONAIS["2026-06-04"]).toMatch(/Corpus/);
    expect(FERIADOS_NACIONAIS["2027-03-26"]).toMatch(/Santa/);
    expect(FERIADOS_NACIONAIS["2027-05-27"]).toMatch(/Corpus/);
    const anos = new Set(Object.keys(FERIADOS_NACIONAIS).map((k) => k.slice(0, 4)));
    expect([...anos].sort()).toEqual(["2026", "2027"]);
  });
});

function enrollment(id: string, campaignSlug: string, status: Enrollment["status"] = "active"): Enrollment {
  return { id, contactId: `c-${id}`, campaignSlug, status, nextStep: 0, createdAt: "2026-09-10T12:00:00.000Z" };
}

describe("#10 campanha ready travada por aprovação gera alerta agregado", () => {
  const def = { ...validacaoIndicacao, status: "ready" as const };
  const runtimeOk: CampaignRuntime = {
    slug: def.slug,
    approvedAt: "2026-09-10T13:53:23.964Z",
    approvedHash: campaignContentHash(def),
  } as CampaignRuntime;

  it("sem aprovação: alerta 'ausente' com a contagem de inscritos ativos", () => {
    const blocks = bloqueiosDeAprovacao([def], [], [enrollment("a", def.slug), enrollment("b", def.slug)]);
    expect(blocks).toEqual([{ campaignSlug: def.slug, inscritos: 2, motivo: "ausente" }]);
  });
  it("copy editada depois do approve: alerta 'invalidada'", () => {
    const editada = {
      ...def,
      steps: [{ ...def.steps[0], body: `${def.steps[0]?.body} (editado)` }, ...def.steps.slice(1)],
    };
    const blocks = bloqueiosDeAprovacao([editada], [runtimeOk], [enrollment("a", def.slug)]);
    expect(blocks[0]?.motivo).toBe("invalidada");
  });
  it("aprovação válida ou inscritos inativos: nenhum alerta", () => {
    expect(bloqueiosDeAprovacao([def], [runtimeOk], [enrollment("a", def.slug)])).toEqual([]);
    expect(bloqueiosDeAprovacao([def], [], [enrollment("a", def.slug, "finished")])).toEqual([]);
  });
});

function contact(id: string, nome: string, empresa: string): Contact {
  return {
    id,
    email: `${id}@exemplo.com.br`,
    nome,
    empresa,
    custom: { frase_colegas: "preview antigo" },
    importBatchId: "t",
    verification: "ok",
    status: "active",
    createdAt: "2026-09-10T12:00:00.000Z",
  };
}

function planItem(contactId: string, stepId = "e1", campaignSlug = "camp"): PlanItem {
  return { contactId, enrollmentId: `en-${contactId}`, campaignSlug, stepId } as PlanItem;
}

describe("#9 frase dos colegas calculada no envio a partir do plano do dia", () => {
  const ana = contact("a", "Ana Silva", "Acme Logística Ltda");
  const bia = contact("b", "Bia", "ACME LOGISTICA");
  const caio = contact("c", "Caio", "Acme Logística");
  const dani = contact("d", "Dani", "Outra Empresa");
  const byId = new Map([ana, bia, caio, dani].map((c) => [c.id, c]));
  const stepComVar = { subject: "x", body: "{{nome}}, oi. {{frase_colegas}}" };
  const stepSemVar = { subject: "x", body: "{{nome}}, oi." };

  it("grupo de 3 no plano: a frase cita os outros 2 (grafias normalizadas contam como a mesma empresa)", () => {
    const items = [planItem("a"), planItem("b"), planItem("c"), planItem("d")];
    expect(colegasNoPlano(ana, items[0] as PlanItem, items, byId)).toEqual(["Bia", "Caio"]);
    const pronto = contatoParaEnvio(ana, stepComVar, items[0] as PlanItem, items, byId);
    expect(pronto.custom.frase_colegas).toBe(fraseColegas(["Bia", "Caio"], ana.empresa));
    expect(pronto.custom.frase_colegas).toContain("Bia e Caio aí na Acme Logística Ltda");
  });
  it("colega que saiu do plano do dia (ou está em outro passo) não é citado; sozinho vira a variante solo", () => {
    const items = [planItem("a"), planItem("b", "e2"), planItem("d")];
    const pronto = contatoParaEnvio(ana, stepComVar, items[0] as PlanItem, items, byId);
    expect(pronto.custom.frase_colegas).toBe(FRASE_SOLO);
    expect(FRASE_SOLO).not.toMatch(/ponta/);
  });
  it("passo sem a variável devolve o contato intacto (campanhas antigas não mudam)", () => {
    const items = [planItem("a"), planItem("b")];
    expect(contatoParaEnvio(ana, stepSemVar, items[0] as PlanItem, items, byId)).toBe(ana);
  });
  it("lista de nomes em português: 1, 2 e 3+", () => {
    expect(listaNomes(["Ana"])).toBe("Ana");
    expect(listaNomes(["Ana", "Bia"])).toBe("Ana e Bia");
    expect(listaNomes(["Ana", "Bia", "Caio"])).toBe("Ana, Bia e Caio");
  });
});
