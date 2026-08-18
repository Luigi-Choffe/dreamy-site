import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { LegalDocument } from "@/components/content/LegalDocument";
import { routes } from "@/config/site";
import { getCookiesPolicy } from "@/content/legal/cookies";
import { createPageMetadata } from "@/lib/seo/metadata";

const doc = getCookiesPolicy();

export const metadata = createPageMetadata({
  title: doc.seo.title,
  description: doc.seo.description,
  path: routes.cookies,
});

export default function CookiesPage() {
  return (
    <LegalDocument
      doc={doc}
      path={routes.cookies}
      extra={
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="font-display text-h4 font-bold">Gerenciar minhas preferências</p>
          <p className="mt-2 text-small text-foreground-muted">
            Você pode alterar as categorias autorizadas a qualquer momento.
          </p>
          <div className="mt-4">
            <CookiePreferencesLink
              label="Abrir preferências de cookies"
              className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-small font-semibold text-foreground no-underline hover:bg-surface-hover hover:no-underline"
            />
          </div>
        </div>
      }
    />
  );
}
