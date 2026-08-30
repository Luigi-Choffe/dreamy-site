import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { CONSOLE_HOME, getSession, safeNextPath } from "@/lib/outbound/auth";
import { requestLoginLinkAction } from "./actions";

/** Sempre dinâmico: depende de cookie e query string. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar no console · interno",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Login do console (PRD-EMAIL-OUTBOUND §16): e-mail → link de acesso por e-mail.
 * A mensagem pós-envio é ÚNICA, esteja o e-mail autorizado ou não (sem enumeração).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));
  if (await getSession()) redirect(next ?? CONSOLE_HOME);

  const sent = first(sp.sent) === "1";
  const expired = first(sp.error) === "expirado";

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <p className="eyebrow">Dreamy Outbound</p>
      <h1 className="mt-1.5 font-display text-h3 font-bold tracking-tight">Entrar no console</h1>
      <p className="mt-2 text-small text-foreground-muted">
        Acesso restrito ao time. Informe seu e-mail e enviamos um link de entrada — sem senha.
      </p>

      <Card padding="md" className="mt-6">
        {sent ? (
          <p
            role="status"
            className="mb-5 rounded-lg border border-brand-strong/30 bg-brand-soft px-4 py-3 text-small text-foreground"
          >
            Se o e-mail estiver autorizado, o link chega em instantes. Ele vale por 15 minutos.
          </p>
        ) : null}
        {expired ? (
          <p role="alert" className="mb-5 rounded-lg bg-error-soft px-4 py-3 text-small font-medium text-error">
            Este link expirou ou não é válido. Peça um novo abaixo.
          </p>
        ) : null}

        <form action={requestLoginLinkAction} className="flex flex-col gap-5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field id="email" label="E-mail" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              placeholder="voce@dreamy.app.br"
            />
          </Field>
          <Button type="submit" className="w-full">
            Enviar link de acesso
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-xs text-foreground-subtle">
        Uso interno · sem indexação · a sessão dura 30 dias neste navegador.
      </p>
    </div>
  );
}
