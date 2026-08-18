"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleAlert } from "lucide-react";
import { TurnstileWidget } from "@/components/forms/TurnstileWidget";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox, ChoiceGroup, Field, Input, Select, Textarea, fieldDescribedBy } from "@/components/ui/Field";
import { BOOKING_URL, TURNSTILE_SITE_KEY } from "@/config/env";
import { routes } from "@/config/site";
import { contactContent } from "@/content/contact";
import { getAttribution } from "@/lib/analytics/attribution";
import { track } from "@/lib/analytics/events";
import {
  DESCRIPTION_MAX,
  STEP1_FIELDS,
  fieldErrors,
  step1Schema,
  step2Schema,
  type LeadFormValues,
} from "@/lib/leads/schema";
import { cn } from "@/lib/utils/cn";
import type { LeadApiError, LeadApiSuccess } from "@/app/api/leads/route";

type Status = "idle" | "submitting" | "success" | "server_error" | "network_error" | "rate_limited";
type Errors = Partial<Record<keyof LeadFormValues | "_form", string>>;

const DRAFT_KEY = "dreamy_lead_draft_v1";
const c = contactContent;

const emptyValues: LeadFormValues = {
  name: "",
  company: "",
  role: "",
  email: "",
  phone: "",
  need: "" as LeadFormValues["need"],
  description: "",
  urgency: "" as LeadFormValues["urgency"],
  investment: "",
  consent: false as unknown as true,
};

const SOLUTION_PARAM_TO_NEED: Record<string, LeadFormValues["need"]> = {
  "nova-receita": "nova-receita",
  sistema: "sistema",
  "agente-ia": "agente-ia",
};

function newSubmissionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Formulário de contato em duas etapas (PRD §34–§39): validação client (mesmo schema do
 * server), estados idle/focus/erro/submitting/success/server error/network error,
 * honeypot, idempotência (submissionId), atribuição, tracking sem PII.
 */
export function LeadForm() {
  const searchParams = useSearchParams();
  const [values, setValues] = useState<LeadFormValues>(emptyValues);
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<LeadApiSuccess | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const submissionId = useRef<string>(newSubmissionId());
  const startedAt = useRef<number | null>(null);
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Restaura rascunho + pré-seleção via ?solucao=
  useEffect(() => {
    let draft: Partial<LeadFormValues> = {};
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw) as Partial<LeadFormValues>;
    } catch {
      /* ignore */
    }
    const param = searchParams.get("solucao");
    const preNeed = param ? SOLUTION_PARAM_TO_NEED[param] : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com sessionStorage/URL após a hidratação (não disponível no servidor)
    setValues((v) => ({ ...v, ...draft, need: preNeed ?? draft.need ?? v.need, consent: false as unknown as true }));
    hydrated.current = true;
  }, [searchParams]);

  // Salva rascunho (exceto consentimento) para sobreviver a refresh
  useEffect(() => {
    if (!hydrated.current || status === "success") return;
    try {
      const { consent: _consent, ...rest } = values;
      void _consent;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  }, [values, status]);

  const markStarted = useCallback(() => {
    if (started.current) return;
    started.current = true;
    startedAt.current = Date.now();
    track({ event: "form_start", page: window.location.pathname });
  }, []);

  const setField = useCallback(
    <K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) => {
      markStarted();
      setValues((v) => ({ ...v, [key]: value }));
      setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    },
    [markStarted],
  );

  const focusFirstError = useCallback((errs: Errors) => {
    const first = Object.keys(errs).find((k) => k !== "_form" && errs[k as keyof Errors]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"], #${first}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  function validateStep(which: 1 | 2): boolean {
    const schema = which === 1 ? step1Schema : step2Schema;
    const parsed = schema.safeParse(values);
    if (parsed.success) return true;
    const errs = fieldErrors(parsed.error) as Errors;
    setErrors(errs);
    for (const [field, message] of Object.entries(errs)) {
      if (message) track({ event: "form_error", field, error_type: "validation" });
    }
    focusFirstError(errs);
    return false;
  }

  function goNext() {
    markStarted();
    if (!validateStep(1)) return;
    track({ event: "form_step_complete", step: 1 });
    setStep(2);
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[name="need"]')?.focus();
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function goBack() {
    setStep(1);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[name="name"]')?.focus());
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return; // double-submit guard
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) return;

    setStatus("submitting");
    setErrors({});
    const payload = {
      ...values,
      website: (formRef.current?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "",
      submissionId: submissionId.current,
      startedAt: startedAt.current ?? undefined,
      page: window.location.pathname,
      attribution: getAttribution(),
      turnstileToken,
    };

    let response: Response;
    try {
      response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      setStatus("network_error");
      track({ event: "form_error", field: "_form", error_type: "network" });
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }

    let data: LeadApiSuccess | LeadApiError | null = null;
    try {
      data = (await response.json()) as LeadApiSuccess | LeadApiError;
    } catch {
      data = null;
    }

    if (response.ok && data && data.ok) {
      setResult(data);
      setStatus("success");
      track({
        event: "form_step_complete",
        step: 2,
      });
      if (data.solution !== "spam") {
        track({
          event: "generate_lead",
          solution: data.solution,
          lead_bucket: data.leadBucket,
          urgency_bucket: data.urgencyBucket,
        });
      }
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      submissionId.current = newSubmissionId();
      requestAnimationFrame(() => successRef.current?.focus());
      return;
    }

    if (response.status === 429) {
      setStatus("rate_limited");
      track({ event: "form_error", field: "_form", error_type: "rate_limit" });
    } else if (response.status === 400 && data && !data.ok && data.code === "validation" && data.errors) {
      setStatus("idle");
      const errs = data.errors as Errors;
      setErrors(errs);
      const stepOneHasError = STEP1_FIELDS.some((f) => errs[f]);
      setStep(stepOneHasError ? 1 : 2);
      for (const field of Object.keys(errs)) track({ event: "form_error", field, error_type: "validation" });
      focusFirstError(errs);
      return;
    } else {
      setStatus("server_error");
      track({ event: "form_error", field: "_form", error_type: "server" });
    }
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  const describe = useMemo(() => fieldDescribedBy, []);

  if (status === "success" && result) {
    return (
      <div
        className="rounded-2xl border border-border bg-surface p-7 shadow-md md:p-10"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong"
          >
            <CheckCircle2 className="size-6" />
          </span>
          <div className="flex flex-col gap-3">
            <h2 ref={successRef} tabIndex={-1} className="font-display text-h3 font-bold outline-none">
              {c.success.title}
            </h2>
            <p className="measure text-body text-foreground-muted">{c.success.text}</p>
          </div>
        </div>
        {BOOKING_URL ? (
          <div className="mt-8 rounded-xl border border-brand/40 bg-brand-soft/50 p-5">
            <p className="font-display text-h4 font-bold">{c.success.bookingTitle}</p>
            <div className="mt-4">
              <LinkButton
                href={BOOKING_URL}
                external
                leadingIcon={<CalendarDays className="size-4" aria-hidden="true" />}
                onClick={() => track({ event: "schedule_start", page: window.location.pathname })}
              >
                {c.success.bookingCta}
              </LinkButton>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LinkButton href={routes.solutions} variant="secondary">
            {c.success.solutionsCta}
          </LinkButton>
          <LinkButton href={routes.home} variant="ghost">
            {c.success.backHome}
          </LinkButton>
        </div>
      </div>
    );
  }

  const busy = status === "submitting";
  const showFormError = status === "server_error" || status === "network_error" || status === "rate_limited";
  const formErrorMessage =
    status === "rate_limited" ? c.errors.rateLimit : status === "network_error" ? c.errors.network : c.errors.server;

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="rounded-2xl border border-border bg-surface p-6 shadow-md md:p-8"
      aria-describedby="form-steps"
    >
      {/* Indicador de etapas */}
      <ol
        id="form-steps"
        className="mb-8 flex items-center gap-3 text-xs font-semibold"
        aria-label="Etapas do formulário"
      >
        {c.steps.labels.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
                  active && "border-brand-strong bg-brand-soft text-brand-strong",
                  done && "border-border bg-background-secondary text-foreground-muted",
                  !active && !done && "border-border text-foreground-subtle",
                )}
              >
                <span className="grid size-5 place-items-center rounded-full bg-surface text-[0.7rem] tabular-nums">
                  {n}
                </span>
                {label}
              </span>
              {i < c.steps.labels.length - 1 ? <span aria-hidden="true" className="h-px w-6 bg-border" /> : null}
            </li>
          );
        })}
      </ol>

      {/* Honeypot (invisível para humanos) */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {showFormError ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-error/40 bg-error-soft p-4 text-small text-foreground outline-none"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
          <div>
            <p className="font-semibold">{formErrorMessage}</p>
            {status !== "rate_limited" ? (
              <button type="submit" className="mt-2 font-semibold text-brand-strong underline underline-offset-4">
                {c.errors.retry}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Etapa 1 */}
      <fieldset
        className={cn("flex flex-col gap-5", step !== 1 && "hidden")}
        disabled={busy}
        aria-labelledby="step1-legend"
      >
        <legend id="step1-legend" className="sr-only">
          {c.steps.labels[0]}
        </legend>
        <Field id="name" label={c.fields.name.label} error={errors.name} required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder={c.fields.name.placeholder}
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            invalid={Boolean(errors.name)}
            aria-describedby={describe("name", undefined, errors.name)}
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="company" label={c.fields.company.label} error={errors.company} required>
            <Input
              id="company"
              name="company"
              autoComplete="organization"
              placeholder={c.fields.company.placeholder}
              value={values.company}
              onChange={(e) => setField("company", e.target.value)}
              invalid={Boolean(errors.company)}
              aria-describedby={describe("company", undefined, errors.company)}
              required
            />
          </Field>
          <Field id="role" label={c.fields.role.label} error={errors.role} required>
            <Input
              id="role"
              name="role"
              autoComplete="organization-title"
              placeholder={c.fields.role.placeholder}
              value={values.role}
              onChange={(e) => setField("role", e.target.value)}
              invalid={Boolean(errors.role)}
              aria-describedby={describe("role", undefined, errors.role)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="email" label={c.fields.email.label} hint={c.fields.email.hint} error={errors.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={c.fields.email.placeholder}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              invalid={Boolean(errors.email)}
              aria-describedby={describe("email", c.fields.email.hint, errors.email)}
              required
            />
          </Field>
          <Field id="phone" label={c.fields.phone.label} error={errors.phone} required>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={c.fields.phone.placeholder}
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
              invalid={Boolean(errors.phone)}
              aria-describedby={describe("phone", undefined, errors.phone)}
              required
            />
          </Field>
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={goNext}
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            {c.steps.next}
          </Button>
        </div>
      </fieldset>

      {/* Etapa 2 */}
      <fieldset
        className={cn("flex flex-col gap-7", step !== 2 && "hidden")}
        disabled={busy}
        aria-labelledby="step2-legend"
      >
        <legend id="step2-legend" className="sr-only">
          {c.steps.labels[1]}
        </legend>
        <ChoiceGroup
          name="need"
          legend={c.fields.need.label}
          options={c.fields.need.options}
          value={values.need}
          onChange={(v) => setField("need", v as LeadFormValues["need"])}
          error={errors.need}
          required
        />
        <Field id="description" label={c.fields.description.label} error={errors.description} required>
          <Textarea
            id="description"
            name="description"
            placeholder={c.fields.description.placeholder}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            invalid={Boolean(errors.description)}
            aria-describedby={describe("description", undefined, errors.description)}
            maxLength={DESCRIPTION_MAX + 200}
            rows={6}
            required
          />
          <p className="text-right text-xs text-foreground-subtle" aria-live="polite">
            {values.description.length}/{DESCRIPTION_MAX}
          </p>
        </Field>
        <ChoiceGroup
          name="urgency"
          legend={c.fields.urgency.label}
          options={c.fields.urgency.options}
          value={values.urgency}
          onChange={(v) => setField("urgency", v as LeadFormValues["urgency"])}
          error={errors.urgency}
          columns={2}
          required
        />
        <Field
          id="investment"
          label={c.fields.investment.label}
          hint={c.fields.investment.hint}
          error={errors.investment}
        >
          <Select
            id="investment"
            name="investment"
            placeholder="Selecione uma faixa (opcional)"
            options={c.fields.investment.options}
            value={values.investment ?? ""}
            onChange={(e) => setField("investment", e.target.value as LeadFormValues["investment"])}
            aria-describedby={describe("investment", c.fields.investment.hint, errors.investment)}
          />
        </Field>
        <Checkbox
          id="consent"
          name="consent"
          checked={Boolean(values.consent)}
          onChange={(e) => setField("consent", e.target.checked as unknown as true)}
          invalid={Boolean(errors.consent)}
          error={errors.consent}
          label={
            <>
              {c.fields.consent.label}{" "}
              <Link
                href={c.fields.consent.href}
                className="font-medium text-brand-strong underline underline-offset-4"
                target="_blank"
              >
                {c.fields.consent.linkLabel}
              </Link>
              {c.fields.consent.after}
            </>
          }
        />
        {TURNSTILE_SITE_KEY ? <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} /> : null}
        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            leadingIcon={<ArrowLeft className="size-4" aria-hidden="true" />}
          >
            {c.steps.back}
          </Button>
          <Button type="submit" size="lg" loading={busy} loadingLabel={c.steps.submitting} disabled={busy}>
            {c.steps.submit}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
