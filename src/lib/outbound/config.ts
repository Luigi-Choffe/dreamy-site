/**
 * Configuração operacional do outbound (PRD §17, §25).
 * Secrets ficam em env (nunca em NEXT_PUBLIC_*); janelas/caps têm defaults seguros.
 */

export interface SendWindow {
  /** minutos desde 00:00 no fuso de envio */
  startMin: number;
  endMin: number;
}

export interface OutboundEnv {
  apiKey: string | null;
  from: string | null;
  replyTo: string | null;
  /** offset fixo do fuso de envio (São Paulo, sem DST desde 2019) */
  utcOffset: string;
  window: SendWindow;
  dailyCapEnv: number | null;
}

function parseWindow(raw: string | undefined): SendWindow {
  const fallback: SendWindow = { startMin: 9 * 60, endMin: 17 * 60 + 30 };
  if (!raw) return fallback;
  const m = raw.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return fallback;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (startMin >= endMin) return fallback;
  return { startMin, endMin };
}

export function getOutboundEnv(): OutboundEnv {
  const cap = process.env.OUTBOUND_DAILY_CAP ? Number(process.env.OUTBOUND_DAILY_CAP) : NaN;
  return {
    apiKey: process.env.OUTBOUND_RESEND_API_KEY?.trim() || null,
    from: process.env.OUTBOUND_FROM?.trim() || null,
    replyTo: process.env.OUTBOUND_REPLY_TO?.trim() || null,
    utcOffset: process.env.OUTBOUND_UTC_OFFSET?.trim() || "-03:00",
    window: parseWindow(process.env.OUTBOUND_SEND_WINDOW),
    dailyCapEnv: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null,
  };
}

/** Lança com mensagem acionável se faltar env obrigatória para envio real. */
export function assertSendReady(env: OutboundEnv): asserts env is OutboundEnv & {
  apiKey: string;
  from: string;
  replyTo: string;
} {
  const missing: string[] = [];
  if (!env.apiKey) missing.push("OUTBOUND_RESEND_API_KEY");
  if (!env.from) missing.push("OUTBOUND_FROM");
  if (!env.replyTo) missing.push("OUTBOUND_REPLY_TO");
  if (missing.length > 0) {
    throw new Error(`Envio real exige env: ${missing.join(", ")} (defina em .env.local — nomes em .env.example).`);
  }
}

/**
 * Rampa de volume por idade do domínio de envio (PRD §17).
 * Semana 1: 15/dia · 2: 30 · 3: 50 · 4+: 80 (teto da V1 — escalar = mais domínios).
 */
export function rampCap(firstSendAt: string | undefined, now: Date): number {
  if (!firstSendAt) return 15;
  const days = Math.floor((now.getTime() - new Date(firstSendAt).getTime()) / 86_400_000);
  if (days < 7) return 15;
  if (days < 14) return 30;
  if (days < 21) return 50;
  return 80;
}

/** Data-calendário (YYYY-MM-DD) no fuso de envio. */
export function sendDateKey(now: Date, utcOffset: string): string {
  return localParts(now, utcOffset).date;
}

/** Dia útil no fuso de envio (sem feriados na V1 — cadência tolera). */
export function isBusinessDay(now: Date, utcOffset: string): boolean {
  const dow = localParts(now, utcOffset).dayOfWeek;
  return dow >= 1 && dow <= 5;
}

export interface LocalParts {
  date: string;
  minutesOfDay: number;
  /** 0=domingo … 6=sábado */
  dayOfWeek: number;
}

const OFFSET_RE = /^([+-])(\d{2}):(\d{2})$/;

export function offsetMinutes(utcOffset: string): number {
  const m = utcOffset.match(OFFSET_RE);
  if (!m) return -180;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

export function localParts(now: Date, utcOffset: string): LocalParts {
  const shifted = new Date(now.getTime() + offsetMinutes(utcOffset) * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

/** ISO com offset para `scheduled_at` do Resend (minuto local do dia indicado). */
export function isoAtLocalMinute(dateKey: string, minutesOfDay: number, utcOffset: string): string {
  const h = String(Math.floor(minutesOfDay / 60)).padStart(2, "0");
  const min = String(minutesOfDay % 60).padStart(2, "0");
  return `${dateKey}T${h}:${min}:00${utcOffset}`;
}
