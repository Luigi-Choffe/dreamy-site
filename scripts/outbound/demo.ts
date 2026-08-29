/**
 * `pnpm outbound:demo` — povoa `.outbound-demo/` com dados SIMULADOS para o console
 * (`/interno/outbound?demo=1`). Serve para ver a plataforma funcionando antes da
 * primeira lista real. NADA aqui é métrica real: contatos "Ana Demo 01", empresas
 * "Empresa Demo 01", e-mails no TLD reservado `.example` (nunca entrega), notas de
 * resposta genéricas. O banner de demo do console deixa isso explícito.
 *
 * Idempotente: apaga e recria o conteúdo do diretório a cada execução.
 * Determinístico: PRNG próprio com seed fixa (LCG) — nada de Math.random — para o
 * e2e (`tests/e2e/outbound-console.spec.ts`) ser estável entre execuções.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { campaigns } from "../../src/content/outbound";
import { isBusinessDay, isoAtLocalMinute, sendDateKey } from "../../src/lib/outbound/config";
import { campaignContentHash } from "../../src/lib/outbound/render";
import { openStore, runExclusive } from "../../src/lib/outbound/store";
import type {
  CampaignDefinition,
  CampaignRuntime,
  Contact,
  Enrollment,
  EnrollmentStatus,
  ImportBatch,
  OutboundEvent,
  Reply,
  ReplyClass,
  SendRecord,
  SendStatus,
  StopReason,
  Suppression,
} from "../../src/lib/outbound/types";

/**
 * HARDCODE de propósito: o demo escreve SEMPRE em `<repo>/.outbound-demo` e IGNORA
 * `OUTBOUND_STORE_DIR`. A env aponta para o store REAL (contatos e envios de verdade)
 * e este script apaga e recria tudo — jamais pode tocar o store real, nem por engano
 * de configuração. O console lê o mesmo caminho fixo (`demoDir()` em
 * `src/app/interno/outbound/data.ts`).
 */
const DEMO_DIR = path.join(process.cwd(), ".outbound-demo");

const UTC_OFFSET = "-03:00";
const DAY = 86_400_000;
/** Janela simulada: t = 0 (há 21 dias) … t = SIM_DAYS (hoje). */
const SIM_DAYS = 21;
/** Dia (t) em que a campanha de agentes foi pausada pelo guard-rail de bounce. */
const PAUSE_T = 19;

// ─── PRNG determinístico (LCG) — e2e estável exige mesma sequência sempre ────

let rngState = 20260401 >>> 0;
function rand(): number {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState / 4_294_967_296;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ─── Utilitários de tempo ────────────────────────────────────────────────────

const now = new Date();
const dateAt = (t: number) => new Date(now.getTime() - (SIM_DAYS - t) * DAY);
const isoAt = (t: number, minutesOfDay: number) =>
  isoAtLocalMinute(sendDateKey(dateAt(t), UTC_OFFSET), minutesOfDay, UTC_OFFSET);
/** Minuto aleatório dentro da janela de envio 09:00–17:30. */
const minuteInWindow = () => 9 * 60 + Math.floor(rand() * 500);
const plusMinutes = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString();

/** Data-calendário do enésimo dia útil DEPOIS de hoje. */
function businessDateKeyAfter(offsetBiz: number): string {
  let d = now;
  let count = 0;
  while (count < offsetBiz) {
    d = new Date(d.getTime() + DAY);
    if (isBusinessDay(d, UTC_OFFSET)) count += 1;
  }
  return sendDateKey(d, UTC_OFFSET);
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");

// ─── Fixtures inequivocamente falsas ─────────────────────────────────────────

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Fábio",
  "Gabriela",
  "Heitor",
  "Iara",
  "João",
  "Karina",
  "Lucas",
  "Marina",
  "Nelson",
  "Olívia",
  "Paulo",
  "Regina",
  "Sérgio",
  "Tatiana",
  "Vicente",
];
const CARGOS = [
  "CEO",
  "COO",
  "Diretor de Operações",
  "Diretora Comercial",
  "Sócio-diretor",
  "Gerente de Operações",
  "Head de Vendas",
  "Diretor Financeiro",
];
const PORTES = ["11-50", "51-200", "201-500"];

const TOTAL_CONTACTS = 60;
const RISKY = new Set([12, 27, 44]);
const INVALID = new Set([18, 51]);
const UNVERIFIED = new Set([33, 58]);
const EXCLUDED = new Map<number, string>([
  [21, "cargo fora do ICP"],
  [42, "e-mail genérico de grupo"],
]);

type Plan =
  | { kind: "bounce"; hard: boolean }
  | { kind: "unsubscribe"; afterStep: number }
  | { kind: "reply"; afterStep: number; classification: ReplyClass; notes: string };

interface Sim {
  id: string;
  contact: Contact;
  def: CampaignDefinition;
  plan?: Plan;
  createdT?: number;
  createdAt?: string;
  nextStep: number;
  lastT?: number;
  lastSendAt?: string;
  status: EnrollmentStatus;
  stopReason?: StopReason;
}

function requireDef(slug: string): CampaignDefinition {
  const def = campaigns.find((c) => c.slug === slug);
  if (!def) {
    console.error(`Campanha "${slug}" não está no registry (src/content/outbound) — o demo depende dela.`);
    process.exit(1);
  }
  return def;
}

async function main(): Promise<void> {
  const nova = requireDef("exemplo-nova-receita");
  const sistemas = requireDef("exemplo-sistemas");
  const agentes = requireDef("exemplo-agentes");

  // Apaga e recria arquivo a arquivo (e não o diretório inteiro) para preservar o
  // `.lock` do runExclusive que está DENTRO do diretório.
  const STORE_FILES = [
    "contacts.json",
    "campaigns.json",
    "enrollments.json",
    "sends.json",
    "suppressions.json",
    "replies.json",
    "imports.json",
    "events.jsonl",
    "config.json",
  ];
  for (const file of STORE_FILES) {
    await fs.rm(path.join(DEMO_DIR, file), { force: true });
  }

  const store = openStore(DEMO_DIR);
  const importedAt = new Date(now.getTime() - (SIM_DAYS + 1) * DAY).toISOString();

  // Contatos ------------------------------------------------------------------
  const contacts: Contact[] = [];
  for (let n = 1; n <= TOTAL_CONTACTS; n += 1) {
    const nn = pad2(n);
    contacts.push({
      id: `demo-contact-${nn}`,
      email: `contato${nn}@empresa-demo-${nn}.example`,
      nome: FIRST_NAMES[(n - 1) % FIRST_NAMES.length]!,
      sobrenome: `Demo ${nn}`,
      cargo: CARGOS[(n - 1) % CARGOS.length],
      empresa: `Empresa Demo ${nn}`,
      dominio: `empresa-demo-${nn}.example`,
      industria: "exemplo",
      porte: PORTES[(n - 1) % PORTES.length],
      custom: {},
      importBatchId: "demo-import-01",
      verification: RISKY.has(n) ? "risky" : INVALID.has(n) ? "invalid" : UNVERIFIED.has(n) ? "unverified" : "ok",
      status: EXCLUDED.has(n) ? "excluded" : "active",
      excludedReason: EXCLUDED.get(n),
      createdAt: importedAt,
    });
  }

  // Elegíveis (status active + verificação ok), na ordem da lista — os planos de
  // bounce/resposta/descadastro abaixo são indexados pelo slot dentro da campanha.
  const eligible = contacts.filter((c) => c.status === "active" && c.verification === "ok");
  const novaSlots = eligible.slice(0, 17);
  const sistemasSlots = eligible.slice(17, 34);
  const agentesSlots = eligible.slice(34, 48);

  // slot → plano (afterStep é índice 0-based do passo: 0 = e1, 1 = e2, 2 = e3).
  const PLANS: Record<string, Record<number, Plan>> = {
    [nova.slug]: {
      1: { kind: "reply", afterStep: 1, classification: "interested", notes: "chamou para uma call na sexta" },
      6: { kind: "reply", afterStep: 2, classification: "not_now", notes: "pediu retorno em outubro" },
      8: { kind: "unsubscribe", afterStep: 1 }, // contato demo-contact-09 → supressão unsubscribe
      10: { kind: "reply", afterStep: 2, classification: "interested", notes: "perguntou como funciona o diagnóstico" },
      13: { kind: "reply", afterStep: 0, classification: "negative", notes: "sem interesse, pediu para não insistir" },
    },
    [sistemas.slug]: {
      2: { kind: "reply", afterStep: 0, classification: "interested", notes: "pediu detalhes de escopo e prazo" },
      5: { kind: "reply", afterStep: 1, classification: "not_now", notes: "orçamento do trimestre já fechado" },
      7: { kind: "reply", afterStep: 1, classification: "referral", notes: "encaminhou para o diretor de operações" },
      8: { kind: "bounce", hard: true }, // contato demo-contact-30 → supressão hard_bounce
      10: { kind: "reply", afterStep: 0, classification: "ooo", notes: "resposta automática, volta em duas semanas" },
      12: { kind: "reply", afterStep: 2, classification: "interested", notes: "quer entender a integração com o ERP" },
    },
    [agentes.slug]: {
      1: { kind: "reply", afterStep: 1, classification: "interested", notes: "topou uma conversa de 20 minutos" },
      3: { kind: "bounce", hard: false },
      5: { kind: "reply", afterStep: 0, classification: "not_now", notes: "sem agenda neste mês" },
      7: { kind: "bounce", hard: false },
      9: { kind: "reply", afterStep: 1, classification: "other", notes: "assistente pediu mais contexto por escrito" },
    },
  };

  let enrollmentCounter = 0;
  const buildSims = (def: CampaignDefinition, slots: Contact[]): Sim[] =>
    slots.map((contact, idx) => {
      enrollmentCounter += 1;
      return {
        id: `demo-enr-${pad2(enrollmentCounter)}`,
        contact,
        def,
        plan: PLANS[def.slug]?.[idx],
        nextStep: 0,
        status: "active" as const,
      };
    });

  const lists = [buildSims(nova, novaSlots), buildSims(sistemas, sistemasSlots), buildSims(agentes, agentesSlots)];
  // Ordem de matrícula intercalada entre campanhas (round-robin), como na operação real.
  const enrollOrder: Sim[] = [];
  const maxLen = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of lists) {
      const sim = list[i];
      if (sim) enrollOrder.push(sim);
    }
  }

  // Simulação dia a dia -------------------------------------------------------
  const sends: SendRecord[] = [];
  const replies: Reply[] = [];
  const events: Array<Omit<OutboundEvent, "id" | "recordedAt">> = [];
  const suppressionEntries: Array<Omit<Suppression, "createdAt">> = [];
  const sims: Sim[] = [];
  let sendCounter = 0;
  let replyCounter = 0;
  let firstSendAt: string | undefined;

  // Rampa do PRD §17 na idade simulada do domínio: semana 1 = 15/dia · 2 = 30 · 3 = 50.
  const capAt = (t: number) => (t < 7 ? 15 : t < 14 ? 30 : 50);
  const newPerDay = (t: number) => (t < 7 ? 6 : 8);

  function sendStep(sim: Sim, t: number): void {
    const stepIdx = sim.nextStep;
    const step = sim.def.steps[stepIdx]!;
    sendCounter += 1;
    const id = `demo-send-${pad3(sendCounter)}`;
    const sentAt = isoAt(t, minuteInWindow());
    if (firstSendAt === undefined) firstSendAt = sentAt;

    const plan = sim.plan;
    const bounced = plan?.kind === "bounce" && stepIdx === 0;
    const status: SendStatus = bounced ? "bounced" : t === SIM_DAYS ? "sent" : "delivered";
    const send: SendRecord = {
      id,
      enrollmentId: sim.id,
      contactId: sim.contact.id,
      campaignSlug: sim.def.slug,
      stepId: step.id,
      idempotencyKey: `${sim.def.slug}/${sim.contact.id}/${step.id}`,
      resendEmailId: `demo-${sendCounter}`,
      scheduledAt: sentAt,
      sentAt,
      status,
    };
    events.push({
      sendId: id,
      campaignSlug: sim.def.slug,
      type: "sent",
      sourceKey: `demo:${id}:sent`,
      occurredAt: new Date(Date.parse(sentAt)).toISOString(),
    });

    sim.nextStep = stepIdx + 1;
    sim.lastT = t;
    sim.lastSendAt = sentAt;

    if (bounced) {
      events.push({
        sendId: id,
        campaignSlug: sim.def.slug,
        type: "bounced",
        sourceKey: `demo:${id}:bounced`,
        occurredAt: plusMinutes(sentAt, randInt(3, 25)),
      });
      sim.status = "stopped";
      sim.stopReason = "bounce";
      if (plan?.kind === "bounce" && plan.hard) {
        suppressionEntries.push({ email: sim.contact.email, reason: "hard_bounce", origin: "sync (demo)" });
        sim.contact.status = "suppressed";
      }
      sends.push(send);
      return;
    }

    if (status === "delivered") {
      events.push({
        sendId: id,
        campaignSlug: sim.def.slug,
        type: "delivered",
        sourceKey: `demo:${id}:delivered`,
        occurredAt: plusMinutes(sentAt, randInt(15, 120)),
      });
      // Abertura inflada por proxies (nota fixa do console); clique só onde há link (E3).
      if (rand() < (step.id === "e3" ? 0.45 : 0.35)) {
        send.opened = true;
        const openedAt = plusMinutes(sentAt, randInt(60, 1_560));
        events.push({
          sendId: id,
          campaignSlug: sim.def.slug,
          type: "opened",
          sourceKey: `demo:${id}:opened`,
          occurredAt: openedAt,
        });
        if (step.withLink && rand() < 0.5) {
          send.clicked = true;
          events.push({
            sendId: id,
            campaignSlug: sim.def.slug,
            type: "clicked",
            sourceKey: `demo:${id}:clicked`,
            occurredAt: plusMinutes(openedAt, randInt(2, 90)),
          });
        }
      }
    }
    sends.push(send);

    if (sim.nextStep >= sim.def.steps.length) sim.status = "finished";

    if (plan?.kind === "reply" && plan.afterStep === stepIdx) {
      replyCounter += 1;
      const receivedAt = plusMinutes(sentAt, randInt(3 * 60, 40 * 60));
      replies.push({
        id: `demo-reply-${pad2(replyCounter)}`,
        contactId: sim.contact.id,
        campaignSlug: sim.def.slug,
        classification: plan.classification,
        notes: plan.notes,
        receivedAt,
        recordedAt: plusMinutes(receivedAt, randInt(30, 300)),
      });
      // Resposta real para a sequência; ooo não é resposta real (PRD §14) — segue.
      if (plan.classification !== "ooo") {
        sim.status = "replied";
        sim.stopReason = "reply";
      }
    }
    if (plan?.kind === "unsubscribe" && plan.afterStep === stepIdx) {
      sim.status = "stopped";
      sim.stopReason = "unsubscribe";
      suppressionEntries.push({ email: sim.contact.email, reason: "unsubscribe", origin: sim.def.slug });
      sim.contact.status = "suppressed";
    }
  }

  let poolIdx = 0;
  for (let t = 0; t <= SIM_DAYS; t += 1) {
    if (!isBusinessDay(dateAt(t), UTC_OFFSET)) continue;
    let budget = capAt(t);

    // Follow-ups devidos primeiro (cadência antes de volume novo).
    for (const sim of sims) {
      if (budget <= 0) break;
      if (sim.status !== "active" || sim.nextStep === 0 || sim.nextStep >= sim.def.steps.length) continue;
      if (sim.def.slug === agentes.slug && t >= PAUSE_T) continue; // campanha pausada
      const due = (sim.lastT ?? 0) + sim.def.steps[sim.nextStep]!.offsetDays;
      if (due > t) continue;
      sendStep(sim, t);
      budget -= 1;
    }

    // Matrículas novas com o orçamento restante do dia.
    let novos = 0;
    while (budget > 0 && novos < newPerDay(t) && poolIdx < enrollOrder.length) {
      const sim = enrollOrder[poolIdx]!;
      poolIdx += 1;
      if (sim.def.slug === agentes.slug && t >= PAUSE_T) continue; // pausada: não matricula
      sim.createdT = t;
      sim.createdAt = isoAt(t, 8 * 60 + 45);
      sims.push(sim);
      sendStep(sim, t);
      budget -= 1;
      novos += 1;
    }
  }

  // Agendados de hoje/futuro (campanhas aprovadas) ----------------------------
  const todayKey = sendDateKey(now, UTC_OFFSET);
  const schedulable = sims.filter(
    (s) => s.status === "active" && s.def.slug !== agentes.slug && s.nextStep < s.def.steps.length,
  );
  schedulable.slice(0, 6).forEach((sim, i) => {
    sendCounter += 1;
    const step = sim.def.steps[sim.nextStep]!;
    const scheduledAt =
      i < 2
        ? isoAtLocalMinute(todayKey, 16 * 60 + 30 + i * 25, UTC_OFFSET)
        : isoAtLocalMinute(businessDateKeyAfter(1 + Math.floor((i - 2) / 2)), 9 * 60 + 20 + i * 47, UTC_OFFSET);
    sends.push({
      id: `demo-send-${pad3(sendCounter)}`,
      enrollmentId: sim.id,
      contactId: sim.contact.id,
      campaignSlug: sim.def.slug,
      stepId: step.id,
      idempotencyKey: `${sim.def.slug}/${sim.contact.id}/${step.id}`,
      resendEmailId: `demo-${sendCounter}`,
      scheduledAt,
      status: "scheduled",
    });
    // Mesma semântica do motor: agendar avança o passo (o cancel rebobina).
    sim.nextStep += 1;
    sim.lastSendAt = scheduledAt;
    if (sim.nextStep >= sim.def.steps.length) sim.status = "finished";
  });

  // Cancelados pela pausa da campanha de agentes ------------------------------
  const pausedAtIso = new Date(Date.parse(isoAt(PAUSE_T, 11 * 60))).toISOString();
  const cancelable = sims.filter(
    (s) => s.status === "active" && s.def.slug === agentes.slug && s.nextStep >= 1 && s.nextStep < s.def.steps.length,
  );
  cancelable.slice(0, 2).forEach((sim, i) => {
    sendCounter += 1;
    const step = sim.def.steps[sim.nextStep]!;
    const id = `demo-send-${pad3(sendCounter)}`;
    sends.push({
      id,
      enrollmentId: sim.id,
      contactId: sim.contact.id,
      campaignSlug: sim.def.slug,
      stepId: step.id,
      idempotencyKey: `${sim.def.slug}/${sim.contact.id}/${step.id}`,
      resendEmailId: `demo-${sendCounter}`,
      scheduledAt: isoAt(PAUSE_T + i, i === 0 ? 16 * 60 : 10 * 60),
      status: "canceled",
    });
    events.push({
      sendId: id,
      campaignSlug: sim.def.slug,
      type: "canceled",
      sourceKey: `demo:${id}:canceled`,
      occurredAt: pausedAtIso,
    });
    // Enrollment rebobinado pelo cancel: nextStep continua apontando para o passo.
  });

  // Supressão herdada de lista anterior (sem contato correspondente na base atual).
  suppressionEntries.push({
    email: "contato-antigo@dominio-descontinuado.example",
    reason: "hard_bounce",
    origin: "lista anterior (demo)",
  });

  // Runtimes: 2 aprovadas + 1 pausada pelo guard-rail de bounce (PRD §21).
  const approvedAt = importedAt;
  const runtimes: CampaignRuntime[] = [
    { slug: nova.slug, approvedAt, approvedBy: "Rafael (demo)", approvedHash: campaignContentHash(nova) },
    { slug: sistemas.slug, approvedAt, approvedBy: "Rafael (demo)", approvedHash: campaignContentHash(sistemas) },
    {
      slug: agentes.slug,
      approvedAt,
      approvedBy: "Rafael (demo)",
      approvedHash: campaignContentHash(agentes),
      pausedAt: pausedAtIso,
      pausedReason: "bounce-rate",
    },
  ];

  const importBatch: ImportBatch = {
    id: "demo-import-01",
    file: "lista-demo.xlsx",
    origin: "Demo — dados simulados (nenhum contato real)",
    importedAt,
    rows: 64,
    imported: 60,
    excluded: 2,
    duplicates: 1,
    invalid: 1,
  };

  const enrollmentRows: Enrollment[] = sims.map((sim) => ({
    id: sim.id,
    contactId: sim.contact.id,
    campaignSlug: sim.def.slug,
    status: sim.status,
    stopReason: sim.stopReason,
    nextStep: sim.nextStep,
    lastSendAt: sim.lastSendAt,
    createdAt: sim.createdAt ?? importedAt,
  }));

  // Persistência (formatos do store da fundação) ------------------------------
  await store.saveContacts(contacts);
  await store.saveCampaignRuntimes(runtimes);
  await store.saveEnrollments(enrollmentRows);
  await store.saveSends(sends);
  await store.saveReplies(replies);
  await store.saveImports([importBatch]);
  for (const entry of suppressionEntries) {
    await store.suppress(entry); // createdAt = agora (momento em que o demo foi gerado)
  }
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const event of events) {
    await store.appendEvent(event);
  }
  await store.saveState({ armed: false, firstSendAt });

  // Resumo -------------------------------------------------------------------
  const count = (st: SendStatus) => sends.filter((s) => s.status === st).length;
  const contactCount = (st: Contact["status"]) => contacts.filter((c) => c.status === st).length;
  const interested = replies.filter((r) => r.classification === "interested").length;
  console.log(`Demo gerado em ${DEMO_DIR} (dados 100% simulados):`);
  console.log(
    `  contatos:    ${contacts.length} (${contactCount("active")} ativos · ${contactCount("excluded")} excluídos · ${contactCount("suppressed")} suprimidos)`,
  );
  console.log(`  campanhas:   3 (2 aprovadas · 1 pausada por bounce-rate)`);
  console.log(`  enrollments: ${enrollmentRows.length}`);
  console.log(
    `  envios:      ${sends.length} (delivered ${count("delivered")} · sent ${count("sent")} · bounced ${count(
      "bounced",
    )} · scheduled ${count("scheduled")} · canceled ${count("canceled")})`,
  );
  console.log(`  respostas:   ${replies.length} (${interested} interessados)`);
  console.log(`  supressões:  ${suppressionEntries.length}`);
  console.log(`  eventos:     ${events.length}`);
  console.log("");
  console.log("Abra o console: pnpm dev e acesse /interno/outbound?demo=1");
}

runExclusive("demo", main, DEMO_DIR).catch((err) => {
  console.error(`outbound:demo falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
