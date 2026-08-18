import * as z from "zod/mini";

/**
 * Schema do lead (PRD §35–§36, §40). Compartilhado entre o formulário (client)
 * e o Route Handler (server) — a validação server-side é a autoridade.
 *
 * `zod/mini` (tree-shakeable) mantém o bundle do formulário pequeno; `jitless`
 * evita `new Function` (compatível com CSP sem 'unsafe-eval' — PRD §76).
 */
z.config({ jitless: true });

export const NEED_VALUES = ["nova-receita", "sistema", "agente-ia", "nao-sei", "outro"] as const;
export const URGENCY_VALUES = ["agora", "30-dias", "1-3-meses", "3-6-meses", "pesquisando"] as const;
export const INVESTMENT_VALUES = ["ate-20k", "20-50k", "50-100k", "100-250k", "250k-mais", "indefinido"] as const;

export type NeedValue = (typeof NEED_VALUES)[number];
export type UrgencyValue = (typeof URGENCY_VALUES)[number];
export type InvestmentValue = (typeof INVESTMENT_VALUES)[number];

export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 3000;
export const MAX_PAYLOAD_BYTES = 16 * 1024;
/** tempo mínimo plausível entre abrir o formulário e enviar (anti-bot) */
export const MIN_FILL_TIME_MS = 3000;

/** Caracteres de controle e invisíveis (zero-width, BOM) que nunca fazem parte de texto legítimo. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g;

/** Remove caracteres de controle e espaços redundantes. */
export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

/** Mantém quebras de linha (textarea), remove controle. */
export function cleanMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normaliza telefone brasileiro para dígitos com DDI 55.
 * Números com "+" explícito de outro país não recebem o prefixo 55.
 */
export function normalizePhone(value: string): string {
  const explicitIntl = value.trim().startsWith("+");
  let digits = value.replace(/\D/g, "");
  if (explicitIntl) return digits;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

/** Telefone BR válido: DDI 55 + DDD (11–99) + 8 ou 9 dígitos. */
export function isValidBrPhone(value: string): boolean {
  const digits = normalizePhone(value);
  if (!/^55\d{10,11}$/.test(digits)) return false;
  const ddd = Number(digits.slice(2, 4));
  return ddd >= 11 && ddd <= 99;
}

const cleanedString = z.pipe(z.string(), z.transform(cleanText));

const requiredText = (max: number, message: string) =>
  z.pipe(cleanedString, z.string().check(z.minLength(2, message), z.maxLength(max, `Máximo de ${max} caracteres.`)));

const optionalShortString = (max: number) => z.optional(z.string().check(z.maxLength(max)));

export const attributionSchema = z._default(
  z.partial(
    z.object({
      utm_source: optionalShortString(200),
      utm_medium: optionalShortString(200),
      utm_campaign: optionalShortString(200),
      utm_content: optionalShortString(200),
      utm_term: optionalShortString(200),
      referrer: optionalShortString(300),
      landing_page: optionalShortString(300),
    }),
  ),
  {},
);

export const leadInputSchema = z.object({
  name: requiredText(120, "Informe seu nome."),
  company: requiredText(160, "Informe o nome da empresa."),
  role: requiredText(120, "Informe seu cargo."),
  email: z.pipe(
    z.pipe(
      z.string(),
      z.transform((v) => cleanText(v).toLowerCase()),
    ),
    z.email({ error: "Informe um e-mail válido." }).check(z.maxLength(254, "Informe um e-mail válido.")),
  ),
  phone: z.pipe(
    cleanedString,
    z
      .string()
      .check(
        z.minLength(8, "Informe um telefone válido com DDD."),
        z.maxLength(30, "Informe um telefone válido com DDD."),
        z.refine(isValidBrPhone, "Informe um telefone válido com DDD."),
      ),
  ),
  need: z.enum(NEED_VALUES, { error: "Selecione a opção que melhor descreve sua situação." }),
  description: z.pipe(
    z.pipe(z.string(), z.transform(cleanMultiline)),
    z
      .string()
      .check(
        z.minLength(
          DESCRIPTION_MIN,
          `Descreva o problema ou a oportunidade (mínimo de ${DESCRIPTION_MIN} caracteres).`,
        ),
        z.maxLength(DESCRIPTION_MAX, `O texto ultrapassou o limite de ${DESCRIPTION_MAX} caracteres.`),
      ),
  ),
  urgency: z.enum(URGENCY_VALUES, { error: "Selecione uma opção." }),
  investment: z._default(z.optional(z.union([z.enum(INVESTMENT_VALUES), z.literal("")])), ""),
  consent: z.literal(true, { error: "É necessário concordar com a política de privacidade." }),
  /** honeypot — deve ficar vazio */
  website: z._default(z.optional(z.string().check(z.maxLength(200))), ""),
  submissionId: z.uuid(),
  startedAt: z.optional(z.int().check(z.positive())),
  page: optionalShortString(300),
  attribution: attributionSchema,
  turnstileToken: optionalShortString(4096),
});

export type LeadInput = z.infer<typeof leadInputSchema>;
export type LeadInputRaw = z.input<typeof leadInputSchema>;

/** Campos do formulário (subconjunto editável pelo usuário) — usado no client. */
export type LeadFormValues = Pick<
  LeadInputRaw,
  "name" | "company" | "role" | "email" | "phone" | "need" | "description" | "urgency" | "investment" | "consent"
>;

export const STEP1_FIELDS = ["name", "company", "role", "email", "phone"] as const;
export const STEP2_FIELDS = ["need", "description", "urgency", "investment", "consent"] as const;

/** Schemas por etapa (validação client antes de avançar). */
export const step1Schema = z.pick(leadInputSchema, { name: true, company: true, role: true, email: true, phone: true });
export const step2Schema = z.pick(leadInputSchema, {
  need: true,
  description: true,
  urgency: true,
  investment: true,
  consent: true,
});

export interface IssueLike {
  path: PropertyKey[];
  message: string;
}

/** Extrai o primeiro erro por campo (para o formulário e para a resposta 400). */
export function fieldErrors(error: { issues: ReadonlyArray<IssueLike> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] !== undefined ? String(issue.path[0]) : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
