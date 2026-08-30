/**
 * Dreamy Outbound — tipos do domínio (docs/PRD-EMAIL-OUTBOUND.md).
 * V1 local: store em arquivos JSON (`.outbound/`), envio via Resend, sync por polling.
 */

export type VerificationStatus = "unverified" | "ok" | "risky" | "invalid";

export type ContactStatus = "active" | "excluded" | "suppressed";

export interface Contact {
  id: string;
  email: string;
  nome: string;
  sobrenome?: string;
  cargo?: string;
  empresa?: string;
  dominio?: string;
  industria?: string;
  porte?: string;
  linkedin?: string;
  /** Colunas extras do Clay (aberturas personalizadas, enriquecimento etc.). */
  custom: Record<string, string>;
  importBatchId: string;
  verification: VerificationStatus;
  status: ContactStatus;
  excludedReason?: string;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  file: string;
  /** Origem declarada do dado (LGPD): run do Clay + fontes. */
  origin: string;
  importedAt: string;
  rows: number;
  imported: number;
  excluded: number;
  duplicates: number;
  invalid: number;
}

export type SolutionAnchor = "nova-receita" | "sistema" | "agente-ia";

/**
 * Empresa vinda da tabela de companies do Clay (export separado do de pessoas).
 * No import de pessoas, o contato é enriquecido por match de domínio: campos
 * vazios são preenchidos e `custom` (clientes ativos, ticket, abertura) é mesclado
 * no `Contact.custom` — vira variável de template ({{abertura}} etc.).
 */
export interface Company {
  id: string;
  nome: string;
  /** Domínio normalizado (sem www/protocolo) — chave do join com contatos. */
  dominio: string;
  descricao?: string;
  industria?: string;
  porte?: string;
  tipo?: string;
  local?: string;
  linkedin?: string;
  /** Enriquecimento (clientes_ativos, ticket_medio, moeda, notas, abertura…). */
  custom: Record<string, string>;
  importBatchId: string;
  createdAt: string;
}

export interface CampaignStep {
  /** "e1".."e4" */
  id: string;
  /** Dias após o passo anterior (e1 = 0). */
  offsetDays: number;
  subject: string;
  /** Template texto puro com {{variaveis}}. */
  body: string;
  /** Passo com link (só a partir do E3 — PRD §7). */
  withLink?: boolean;
}

/** Definição versionada em `src/content/outbound/` (copy é conteúdo, não código). */
export interface CampaignDefinition {
  slug: string;
  industria: string;
  anchor: SolutionAnchor;
  /** Campanhas draft nunca são elegíveis para envio. */
  status: "draft" | "ready";
  steps: CampaignStep[];
  /** Notas internas (ângulo, dores mapeadas). */
  notes?: string;
  /**
   * Valores de amostra para variáveis `custom` usadas nos templates (ex.: abertura
   * vinda do enriquecimento). Usados pelo approve, pela prévia do console e pelos
   * testes de conteúdo — no envio real a variável precisa existir no contato.
   */
  sampleCustom?: Record<string, string>;
}

/** Estado runtime da campanha (store) — aprovação e pausa ficam fora do código-fonte. */
export interface CampaignRuntime {
  slug: string;
  approvedAt?: string;
  approvedBy?: string;
  /** Hash do conteúdo aprovado (slug+passos). Copy editada após o approve invalida
   *  a aprovação — o motor recusa enviar até novo `outbound:campaign approve`. */
  approvedHash?: string;
  pausedAt?: string;
  pausedReason?: string;
}

export type EnrollmentStatus = "active" | "replied" | "finished" | "stopped";

export type StopReason = "reply" | "unsubscribe" | "bounce" | "complaint" | "manual" | "breaker";

export interface Enrollment {
  id: string;
  contactId: string;
  campaignSlug: string;
  status: EnrollmentStatus;
  stopReason?: StopReason;
  /** Índice do próximo passo a enviar (0-based em CampaignDefinition.steps). */
  nextStep: number;
  lastSendAt?: string;
  createdAt: string;
}

export type SendStatus =
  /** Registrado localmente ANTES da chamada ao Resend (write-ahead). Um "pending"
   *  remanescente = run interrompido; bloqueia novos envios até resolução
   *  (`outbound:send --resolve-pending`). */
  "pending" | "scheduled" | "sent" | "delivered" | "bounced" | "complained" | "failed" | "canceled";

export interface SendRecord {
  id: string;
  enrollmentId: string;
  contactId: string;
  campaignSlug: string;
  stepId: string;
  /** `${campaignSlug}/${contactId}/${stepId}` — unicidade local contra duplicatas. */
  idempotencyKey: string;
  resendEmailId?: string;
  scheduledAt?: string;
  sentAt?: string;
  status: SendStatus;
  error?: string;
  opened?: boolean;
  clicked?: boolean;
}

export type OutboundEventType =
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked"
  | "failed"
  | "canceled"
  | "suppressed";

export interface OutboundEvent {
  id: string;
  sendId: string;
  campaignSlug: string;
  type: OutboundEventType;
  /** Dedupe: origem do evento (ex.: `sync:{emailId}:{last_event}`). */
  sourceKey: string;
  occurredAt: string;
  recordedAt: string;
}

export type SuppressionReason = "unsubscribe" | "hard_bounce" | "complaint" | "manual" | "client";

export interface Suppression {
  email: string;
  reason: SuppressionReason;
  origin?: string;
  createdAt: string;
}

export type ReplyClass = "interested" | "not_now" | "referral" | "negative" | "ooo" | "other";

export interface Reply {
  id: string;
  contactId: string;
  campaignSlug: string;
  classification: ReplyClass;
  notes?: string;
  receivedAt: string;
  recordedAt: string;
}

/** Estado operacional global (`.outbound/config.json`). */
export interface OutboundState {
  /** Disparos automáticos armados (exige ação explícita do usuário — PRD §20). */
  armed: boolean;
  armedAt?: string;
  /** Primeiro envio real — base da rampa de volume (PRD §17). */
  firstSendAt?: string;
  /** Circuit breaker global (complaint/spam) — religar exige ação humana. */
  breakerTrippedAt?: string;
  breakerReason?: string;
  /** Override manual do cap diário (senão vale a rampa). */
  dailyCapOverride?: number;
}

/** Item do plano do dia (saída de `outbound:plan`, entrada de `outbound:send`). */
export interface PlanItem {
  enrollmentId: string;
  contactId: string;
  email: string;
  campaignSlug: string;
  stepId: string;
  stepIndex: number;
  /** ISO com offset — horário agendado dentro da janela. */
  scheduledAt: string;
}

/* ─── CRM piloto (PRD-EMAIL-OUTBOUND §29; aditivo: o motor de envio nunca lê estas coleções) ─── */

/**
 * Estágio do negócio. "novo"/"contatado"/"respondeu" são automáticos
 * (reconcileDeals, só para frente); de "reuniao_marcada" em diante o movimento é
 * exclusivamente manual.
 */
export type DealStage =
  "novo" | "contatado" | "respondeu" | "reuniao_marcada" | "reuniao_realizada" | "proposta" | "ganho" | "perdido";

export interface DealStageChange {
  stage: DealStage;
  at: string;
  /** E-mail da sessão, "mork" ou "sistema". */
  by: string;
  /** Obrigatório ao mover para "perdido". */
  motivo?: string;
}

export interface Deal {
  id: string;
  contactId: string;
  /** Origem outbound, quando houver. */
  campaignSlug?: string;
  /** Snapshot para render sem join. */
  empresa?: string;
  stage: DealStage;
  /** Piso automático do reconcile; nunca rebaixa estágio manual. */
  autoStage?: "novo" | "contatado" | "respondeu";
  /** BRL. */
  valorEstimado?: number;
  /** Oferta âncora (PRD §11). */
  anchor?: SolutionAnchor;
  /** E-mail do dono. */
  owner?: string;
  /** Data/hora da reunião quando o estágio é reuniao_marcada ou posterior. */
  reuniaoEm?: string;
  lostReason?: string;
  /**
   * Histórico append-only: alimenta a timeline da conta e as métricas
   * (reuniões geradas = negócios que passaram por reuniao_marcada;
   * realizadas = que passaram por reuniao_realizada).
   */
  stageHistory: DealStageChange[];
  stageChangedAt: string;
  stageChangedBy: string;
  createdAt: string;
}

export interface CrmNote {
  id: string;
  contactId: string;
  dealId?: string;
  /** De requireSession; "mork" na CLI. */
  authorEmail: string;
  body: string;
  /** Rascunho de IA salvo pelo humano marca "ia". */
  origin: "manual" | "ia";
  /** Append-only: sem editar nem excluir no v1. */
  createdAt: string;
}

export type CrmTaskStatus = "aberta" | "concluida" | "cancelada";

export interface CrmTask {
  id: string;
  titulo: string;
  contactId?: string;
  dealId?: string;
  /** YYYY-MM-DD (comparação por dia no fuso OUTBOUND_UTC_OFFSET). */
  dueDate: string;
  assignee?: string;
  status: CrmTaskStatus;
  origin: "manual" | "regra" | "ia";
  /** E-mail, "mork" ou "sistema". */
  createdBy: string;
  createdAt: string;
  doneAt?: string;
}

/** "cancelada" = o autor desistiu antes do MORK assumir (só a partir de pendente). */
export type DemandStatus = "pendente" | "em_andamento" | "concluida" | "recusada" | "cancelada";
export type DemandKind = "copy" | "leads" | "analise" | "resposta" | "operacao" | "outra";

/** Pedido do time para o MORK (criado no console, consumido pela CLI outbound:demandas). */
export interface Demand {
  id: string;
  title: string;
  details?: string;
  kind: DemandKind;
  status: DemandStatus;
  priority: "normal" | "alta";
  /** E-mail da sessão do console ou "mork" (CLI). */
  createdBy: string;
  createdAt: string;
  claimedBy?: string;
  claimedAt?: string;
  doneAt?: string;
  /** Obrigatório em concluida/recusada. */
  resolution?: string;
  campaignSlug?: string;
  /** Vínculo por id, nunca por e-mail. */
  contactId?: string;
}

export type AgentActivityKind = "demanda" | "briefing" | "sugestao" | "crm" | "observacao";

/** Prestação de contas do MORK e dos agentes no console (sem PII de e-mail). */
export interface AgentActivity {
  id: string;
  actor: "mork" | "console" | "sistema";
  kind: AgentActivityKind;
  summary: string;
  refs?: {
    demandId?: string;
    dealId?: string;
    campaignSlug?: string;
    contactId?: string;
    replyId?: string;
  };
  at: string;
}

export interface AiBriefing {
  id: string;
  /** YYYY-MM-DD no fuso de envio; 1 por dia, regenerar substitui. */
  dateKey: string;
  generatedAt: string;
  /** E-mail da sessão ou "demo". */
  generatedBy: string;
  /** "claude-sonnet-5" ou "exemplo". */
  model: string;
  /** Texto pt-BR, sem PII. */
  content: string;
  demo?: boolean;
}

/**
 * Documento singleton (id "workspace") na coleção settings. Só apresentação
 * (eyebrow do shell, demo de replicabilidade); JAMAIS alimenta copy, assinatura
 * ou motor de envio (ADR-020).
 */
export interface WorkspaceSettings {
  id: "workspace";
  empresaNome: string;
  operadorNome?: string;
  ofertas: Array<{ anchor: SolutionAnchor; titulo: string; descricao: string }>;
  atualizadoEm: string;
  atualizadoPor?: string;
}
