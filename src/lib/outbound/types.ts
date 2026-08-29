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
  | "pending"
  | "scheduled"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "canceled";

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
