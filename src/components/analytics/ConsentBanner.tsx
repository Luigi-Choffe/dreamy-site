"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { routes } from "@/config/site";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  readConsentCookie,
  saveConsent,
  type ConsentState,
} from "@/lib/consent/consent";
import { cn } from "@/lib/utils/cn";

const copy = {
  title: "Cookies e privacidade",
  text: "Usamos cookies necessários para o site funcionar e, com o seu consentimento, cookies de análise e marketing para entender o uso do site e medir campanhas. Você pode alterar sua escolha a qualquer momento.",
  acceptAll: "Aceitar todos",
  rejectAll: "Somente necessários",
  manage: "Gerenciar",
  policy: "Política de Cookies",
  prefsTitle: "Preferências de cookies",
  prefsText: "Escolha as categorias que você autoriza. Cookies necessários são sempre ativos.",
  save: "Salvar preferências",
  categories: {
    necessary: {
      label: "Necessários",
      description: "Funcionamento do site, segurança e registro da sua escolha de consentimento.",
    },
    analytics: {
      label: "Análise",
      description: "Métricas de uso do site (Google Analytics via Google Tag Manager).",
    },
    marketing: {
      label: "Marketing",
      description: "Medição de campanhas e conversões (Meta, LinkedIn).",
    },
  },
};

/** Store externo mínimo: timestamp da decisão salva no cookie (-1 = servidor/hidratação, 0 = sem decisão). */
function subscribeConsent(callback: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
}
function getConsentSnapshot() {
  return readConsentCookie()?.t ?? 0;
}
function getServerSnapshot() {
  return -1;
}

/**
 * Banner de consentimento próprio (PRD §73): aceitar, rejeitar, gerenciar, alterar depois.
 * Integra com Google Consent Mode v2 (src/lib/consent/consent.ts).
 */
export function ConsentBanner() {
  const decidedAt = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerSnapshot);
  const decided = decidedAt === -1 ? null : decidedAt > 0;
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    const onOpen = () => {
      const saved = readConsentCookie();
      if (saved) setDraft({ analytics: saved.analytics, marketing: saved.marketing });
      setPrefsOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  const decide = useCallback((state: Omit<ConsentState, "v" | "t">) => {
    saveConsent(state); // grava o cookie e dispara CONSENT_CHANGE_EVENT (atualiza o snapshot)
    setDraft({ analytics: state.analytics, marketing: state.marketing });
    setPrefsOpen(false);
  }, []);

  const showBanner = decided === false && !prefsOpen;

  return (
    <>
      {showBanner ? (
        <div
          role="region"
          aria-label={copy.title}
          className={cn("fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4", "motion-safe:animate-rise-in")}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-lg md:flex-row md:items-center md:gap-6">
            <div className="flex-1">
              <p className="font-display text-h4 font-bold text-foreground">{copy.title}</p>
              <p className="mt-1.5 text-small text-foreground-muted">
                {copy.text}{" "}
                <Link
                  href={routes.cookies}
                  className="font-medium text-brand-strong underline-offset-4 hover:underline"
                >
                  {copy.policy}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
              <Button size="sm" onClick={() => decide({ analytics: true, marketing: true })}>
                {copy.acceptAll}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide({ analytics: false, marketing: false })}>
                {copy.rejectAll}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPrefsOpen(true)}>
                {copy.manage}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={prefsOpen} onClose={() => setPrefsOpen(false)} title={copy.prefsTitle} description={copy.prefsText}>
        <div className="flex flex-col gap-3">
          <ConsentRow
            id="consent-necessary"
            label={copy.categories.necessary.label}
            description={copy.categories.necessary.description}
            checked
            disabled
          />
          <ConsentRow
            id="consent-analytics"
            label={copy.categories.analytics.label}
            description={copy.categories.analytics.description}
            checked={draft.analytics}
            onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
          />
          <ConsentRow
            id="consent-marketing"
            label={copy.categories.marketing.label}
            description={copy.categories.marketing.description}
            checked={draft.marketing}
            onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => decide({ analytics: false, marketing: false })}>
            {copy.rejectAll}
          </Button>
          <Button onClick={() => decide(draft)}>{copy.save}</Button>
        </div>
      </Dialog>
    </>
  );
}

function ConsentRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border border-border p-4",
        disabled ? "bg-background-secondary" : "cursor-pointer hover:border-border-strong",
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="text-small font-semibold text-foreground">{label}</span>
        <span className="text-xs text-foreground-muted">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-full opacity-0 focus:outline-none disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            "h-6 w-11 rounded-full border transition-colors duration-(--duration-fast)",
            checked ? "border-brand-strong bg-brand-strong" : "border-border-strong bg-background-secondary",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
            disabled && "opacity-60",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-(--duration-fast)",
            checked && "translate-x-5",
          )}
        />
      </span>
    </label>
  );
}
