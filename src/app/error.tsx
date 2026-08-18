"use client";

import { useEffect } from "react";
import { Section } from "@/components/layout/Section";
import { Button, LinkButton } from "@/components/ui/Button";
import { errorContent } from "@/content/not-found";
import { reportClientError } from "@/lib/observability/client";

/** Error boundary de rota (PRD §81): nunca deixar página em branco. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <Section className="flex min-h-[60vh] items-center">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="eyebrow">Erro</p>
        <h1 className="font-display text-h1 font-bold text-balance">{errorContent.title}</h1>
        <p className="measure text-lead text-foreground-muted">{errorContent.text}</p>
        {error.digest ? <p className="text-xs text-foreground-subtle">Código: {error.digest}</p> : null}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => reset()}>{errorContent.retry}</Button>
          <LinkButton href={errorContent.home.href} variant="secondary">
            {errorContent.home.label}
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
