import { describe, expect, it } from "vitest";
import type { OutboundEnv } from "../../src/lib/outbound/config";
import { computePlan, dailyCap, usedTodayCount } from "../../src/lib/outbound/engine";
import { campaignContentHash } from "../../src/lib/outbound/render";
import type {
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  Enrollment,
  OutboundState,
  SendRecord,
} from "../../src/lib/outbound/types";

/** Terça-feira, 10:00 em São Paulo (janela 09:00–17:30). */
const NOW = new Date("2026-09-01T13:00:00Z");

const ENV: OutboundEnv = {
  apiKey: null,
  from: null,
  replyTo: "vendas@dreamy.app.br",
  utcOffset: "-03:00",
  window: { startMin: 9 * 60, endMin: 17 * 60 + 30 },
  dailyCapEnv: null,
};

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    email: "maria@acme.com.br",
    nome: "Maria",
    empresa: "Acme",
    industria: "distribuição",
    custom: {},
    importBatchId: "b1",
    verification: "ok",
    status: "active",
    createdAt: "2026-08-20T12:00:00Z",
    ...over,
  };
}

function campaign(over: Partial<CampaignDefinition> = {}): CampaignDefinition {
  const body =
    "vi que a operação de vocês cresceu e, quando isso acontece, planilha e sistema " +
    "começam a contar histórias diferentes. queria entender como está aí na {{empresa}}. " +
    "faz sentido conversar sobre isso?\n\nRafael · Dreamy";
  return {
    slug: "dist-teste",
    industria: "distribuição",
    anchor: "sistema",
    status: "ready",
    steps: [
      { id: "e1", offsetDays: 0, subject: "pedidos em planilha na {{empresa}}?", body },
      { id: "e2", offsetDays: 3, subject: "sobre o que te escrevi", body },
      { id: "e3", offsetDays: 7, subject: "um caminho possível", body, withLink: true },
      { id: "e4", offsetDays: 7, subject: "encerro por aqui", body },
    ],
    ...over,
  };
}

function enrollment(over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "en1",
    contactId: "c1",
    campaignSlug: "dist-teste",
    status: "active",
    nextStep: 0,
    createdAt: "2026-08-25T12:00:00Z",
    ...over,
  };
}

function runtime(over: Partial<CampaignRuntime> = {}): CampaignRuntime {
  return { slug: "dist-teste", approvedAt: "2026-08-26T12:00:00Z", ...over };
}

/** Runtime aprovado COM o hash da definição (o motor recusa hash divergente/ausente). */
function approvedRuntime(def: CampaignDefinition, over: Partial<CampaignRuntime> = {}): CampaignRuntime {
  return { slug: def.slug, approvedAt: "2026-08-26T12:00:00Z", approvedHash: campaignContentHash(def), ...over };
}

function send(over: Partial<SendRecord> = {}): SendRecord {
  return {
    id: "s1",
    enrollmentId: "en-x",
    contactId: "c-x",
    campaignSlug: "dist-teste",
    stepId: "e1",
    idempotencyKey: "dist-teste/c-x/e1",
    status: "delivered",
    scheduledAt: "2026-08-31T13:00:00-03:00",
    sentAt: "2026-08-31T13:00:00-03:00",
    ...over,
  };
}

interface PlanOverrides {
  contacts?: Contact[];
  enrollments?: Enrollment[];
  sends?: SendRecord[];
  suppressions?: Array<{ email: string; reason: "unsubscribe"; createdAt: string }>;
  campaignDefs?: CampaignDefinition[];
  runtimes?: CampaignRuntime[];
  state?: OutboundState;
  env?: OutboundEnv;
  now?: Date;
  rng?: () => number;
  campaignFilter?: string;
}

function plan(over: PlanOverrides = {}) {
  const campaignDefs = over.campaignDefs ?? [campaign()];
  // Sem runtimes explícitos, cada definição é considerada aprovada com o hash atual.
  const runtimes = over.runtimes ?? campaignDefs.map((d) => approvedRuntime(d));
  return computePlan({
    contacts: [contact()],
    enrollments: [enrollment()],
    sends: [],
    suppressions: [],
    state: { armed: true },
    env: ENV,
    now: NOW,
    rng: () => 0.5,
    ...over,
    campaignDefs,
    runtimes,
  });
}

describe("dailyCap / usedTodayCount", () => {
  it("segue a rampa quando não há override (dia 0 = 15)", () => {
    expect(dailyCap({ armed: true }, ENV, NOW)).toBe(15);
  });

  it("rampa por idade do primeiro envio (15 → 30 → 50 → 80)", () => {
    expect(dailyCap({ armed: true, firstSendAt: "2026-08-27T12:00:00Z" }, ENV, NOW)).toBe(15);
    expect(dailyCap({ armed: true, firstSendAt: "2026-08-22T12:00:00Z" }, ENV, NOW)).toBe(30);
    expect(dailyCap({ armed: true, firstSendAt: "2026-08-15T12:00:00Z" }, ENV, NOW)).toBe(50);
    expect(dailyCap({ armed: true, firstSendAt: "2026-08-01T12:00:00Z" }, ENV, NOW)).toBe(80);
  });

  it("o menor entre rampa, override do estado e env vence", () => {
    expect(dailyCap({ armed: true, dailyCapOverride: 5 }, ENV, NOW)).toBe(5);
    expect(dailyCap({ armed: true }, { ...ENV, dailyCapEnv: 3 }, NOW)).toBe(3);
  });

  it("conta só envios de hoje que não foram cancelados/falharam", () => {
    const today = "2026-09-01T09:30:00-03:00";
    const sends = [
      send({ id: "a", scheduledAt: today }),
      send({ id: "b", scheduledAt: today, status: "canceled" }),
      send({ id: "c", scheduledAt: today, status: "failed" }),
      send({ id: "d", scheduledAt: "2026-08-31T09:30:00-03:00" }),
    ];
    expect(usedTodayCount(sends, NOW, ENV.utcOffset)).toBe(1);
  });
});

describe("computePlan — bloqueios globais", () => {
  it("breaker global disparado bloqueia tudo", () => {
    const r = plan({ state: { armed: true, breakerTrippedAt: "2026-08-31T12:00:00Z" } });
    expect(r.items).toHaveLength(0);
    expect(r.blockedReason).toMatch(/breaker/);
  });

  it("fim de semana bloqueia (sábado)", () => {
    const r = plan({ now: new Date("2026-09-05T13:00:00Z") });
    expect(r.blockedReason).toMatch(/dia útil/);
  });

  it("depois do fim da janela bloqueia", () => {
    // 21:30 em São Paulo (terça)
    const r = plan({ now: new Date("2026-09-02T00:30:00Z") });
    expect(r.blockedReason).toMatch(/janela/);
  });

  it("cap diário atingido bloqueia", () => {
    const today = "2026-09-01T09:15:00-03:00";
    const sends = Array.from({ length: 15 }, (_, i) =>
      send({ id: `t${i}`, idempotencyKey: `k${i}`, scheduledAt: today }),
    );
    const r = plan({ sends });
    expect(r.blockedReason).toMatch(/cap diário/);
  });
});

describe("computePlan — elegibilidade", () => {
  it("planeja e1 imediatamente para campanha aprovada", () => {
    const r = plan();
    expect(r.blockedReason).toBeUndefined();
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ stepId: "e1", campaignSlug: "dist-teste", email: "maria@acme.com.br" });
  });

  it("campanha draft, não aprovada ou pausada não envia", () => {
    expect(plan({ campaignDefs: [campaign({ status: "draft" })] }).skipped[0]?.reason).toMatch(/draft/);
    expect(plan({ runtimes: [] }).skipped[0]?.reason).toMatch(/sem aprovação/);
    expect(
      plan({ runtimes: [runtime({ pausedAt: "2026-09-01T00:00:00Z", pausedReason: "bounce-rate" })] }).skipped[0]
        ?.reason,
    ).toMatch(/pausada/);
  });

  it("contato suprimido, não verificado ou inativo não recebe", () => {
    expect(
      plan({ suppressions: [{ email: "maria@acme.com.br", reason: "unsubscribe", createdAt: "" }] }).skipped[0]?.reason,
    ).toMatch(/supressão/);
    expect(plan({ contacts: [contact({ verification: "risky" })] }).skipped[0]?.reason).toMatch(/verificação/);
    expect(
      plan({ contacts: [contact({ status: "excluded", excludedReason: "cargo-fora-icp" })] }).skipped[0]?.reason,
    ).toMatch(/excluded/);
  });

  it("follow-up respeita o offset em dias", () => {
    const naoDevido = plan({
      enrollments: [enrollment({ nextStep: 1, lastSendAt: "2026-08-31T10:00:00-03:00" })],
    });
    expect(naoDevido.items).toHaveLength(0);
    expect(naoDevido.skipped[0]?.reason).toMatch(/aguardando cadência/);

    const devido = plan({
      enrollments: [enrollment({ nextStep: 1, lastSendAt: "2026-08-28T10:00:00-03:00" })],
    });
    expect(devido.items).toHaveLength(1);
    expect(devido.items[0]?.stepId).toBe("e2");
  });

  it("idempotência: passo já enviado não repete", () => {
    const r = plan({ sends: [send({ idempotencyKey: "dist-teste/c1/e1", scheduledAt: "2026-08-31T10:00:00-03:00" })] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/idempotência/);
  });

  it("lint bloqueia copy com termo vetado", () => {
    const ruim = campaign();
    ruim.steps[0] = { ...ruim.steps[0], body: `${ruim.steps[0].body}\n\nnosso chatbot resolve.` };
    const r = plan({ campaignDefs: [ruim] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/lint/);
  });

  it("variável de personalização ausente bloqueia o envio", () => {
    const comVar = campaign();
    comVar.steps[0] = { ...comVar.steps[0], body: `{{abertura}}\n\n${comVar.steps[0].body}` };
    const r = plan({ campaignDefs: [comVar] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/abertura/);
  });

  it("bounce acima do guard-rail pausa a campanha no plano", () => {
    const ontem = "2026-08-31T10:00:00-03:00";
    const sends = Array.from({ length: 15 }, (_, i) =>
      send({
        id: `g${i}`,
        idempotencyKey: `g${i}`,
        scheduledAt: ontem,
        status: i === 0 ? "bounced" : "delivered",
      }),
    );
    const r = plan({ sends });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/bounce/);
  });

  it("sequência concluída não gera envio", () => {
    const r = plan({ enrollments: [enrollment({ nextStep: 4, lastSendAt: "2026-08-20T10:00:00-03:00" })] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/concluída/);
  });

  it("copy editada depois da aprovação invalida o envio (hash divergente)", () => {
    const editada = campaign();
    editada.steps[0] = { ...editada.steps[0], subject: "assunto novo depois do approve" };
    // runtime aprovado com o hash da versão ANTIGA
    const r = plan({ campaignDefs: [editada], runtimes: [approvedRuntime(campaign())] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/mudou depois da aprovação/);
  });

  it("aprovação antiga sem hash também exige re-approve", () => {
    const r = plan({ runtimes: [runtime()] });
    expect(r.items).toHaveLength(0);
    expect(r.skipped[0]?.reason).toMatch(/aprovação/);
  });

  it("send canceled não bloqueia o replanejamento do passo (rebobinado pelo sync)", () => {
    const r = plan({
      sends: [
        send({
          idempotencyKey: "dist-teste/c1/e1",
          status: "canceled",
          scheduledAt: "2026-08-31T10:00:00-03:00",
        }),
      ],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.stepId).toBe("e1");
  });

  it("send pending (run interrompido) bloqueia TODO envio até resolução", () => {
    const r = plan({
      sends: [send({ idempotencyKey: "k-pend", status: "pending", scheduledAt: "2026-09-01T09:20:00-03:00" })],
    });
    expect(r.items).toHaveLength(0);
    expect(r.blockedReason).toMatch(/pending/);
  });
});

describe("computePlan — cap e agendamento", () => {
  function many(n: number) {
    const contacts = Array.from({ length: n }, (_, i) =>
      contact({ id: `c${i}`, email: `pessoa${i}@empresa${i}.com.br` }),
    );
    const enrollments = contacts.map((c, i) => enrollment({ id: `en${i}`, contactId: c.id }));
    return { contacts, enrollments };
  }

  it("respeita o cap disponível e marca o excedente", () => {
    const { contacts, enrollments } = many(20);
    const r = plan({ contacts, enrollments });
    expect(r.items).toHaveLength(15);
    expect(r.skipped.filter((s) => s.reason.includes("fora do cap"))).toHaveLength(5);
  });

  it("agenda em goteo: horário crescente, gap ≥ 3 min, dentro da janela", () => {
    const { contacts, enrollments } = many(10);
    const r = plan({ contacts, enrollments, rng: () => 0.5 });
    expect(r.items).toHaveLength(10);
    const minutos = r.items.map((it) => {
      const d = new Date(it.scheduledAt);
      return d.getUTCHours() * 60 + d.getUTCMinutes(); // ISO com offset -03:00 → UTC já normalizado
    });
    for (let i = 1; i < minutos.length; i += 1) {
      expect(minutos[i] - minutos[i - 1]).toBeGreaterThanOrEqual(3);
    }
    for (const it of r.items) {
      expect(it.scheduledAt.endsWith("-03:00")).toBe(true);
      const [, time] = it.scheduledAt.split("T");
      const [hh, mm] = time.split(":").map(Number);
      const local = hh * 60 + mm;
      expect(local).toBeGreaterThanOrEqual(9 * 60);
      expect(local).toBeLessThan(17 * 60 + 30);
    }
  });

  it("primeiro horário nunca antes de agora + 10 min", () => {
    const r = plan();
    const [, time] = r.items[0].scheduledAt.split("T");
    const [hh, mm] = time.split(":").map(Number);
    expect(hh * 60 + mm).toBeGreaterThanOrEqual(10 * 60 + 10);
  });

  it("round-robin entre campanhas", () => {
    const defB = campaign({ slug: "outra-campanha", industria: "saúde" });
    const { contacts, enrollments } = many(4);
    enrollments[1] = { ...enrollments[1], campaignSlug: "outra-campanha" };
    enrollments[3] = { ...enrollments[3], campaignSlug: "outra-campanha" };
    const r = plan({
      contacts,
      enrollments,
      campaignDefs: [campaign(), defB],
      runtimes: [approvedRuntime(campaign()), approvedRuntime(defB)],
    });
    expect(
      r.items
        .map((i) => i.campaignSlug)
        .slice(0, 2)
        .sort(),
    ).toEqual(["dist-teste", "outra-campanha"]);
  });

  it("campaignFilter restringe o plano", () => {
    const defB = campaign({ slug: "outra-campanha" });
    const { contacts, enrollments } = many(2);
    enrollments[1] = { ...enrollments[1], campaignSlug: "outra-campanha" };
    const r = plan({
      contacts,
      enrollments,
      campaignDefs: [campaign(), defB],
      runtimes: [approvedRuntime(campaign()), approvedRuntime(defB)],
      campaignFilter: "outra-campanha",
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].campaignSlug).toBe("outra-campanha");
  });
});
