import { Breadcrumbs } from "@/components/content/Breadcrumbs";
import { Container } from "@/components/layout/Container";
import type { LegalDocument as LegalDocumentModel } from "@/content/legal/privacy";
import type { ReactNode } from "react";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** Renderiza um documento legal estruturado (privacidade, cookies). */
export function LegalDocument({ doc, path, extra }: { doc: LegalDocumentModel; path: string; extra?: ReactNode }) {
  return (
    <article className="pt-8 pb-20 md:pt-10 md:pb-28">
      <Container size="narrow">
        <Breadcrumbs items={[{ name: doc.title, path }]} />
        <header className="mt-8 flex flex-col gap-4">
          <p className="eyebrow">Legal</p>
          <h1 className="font-display text-h1 font-bold text-balance">{doc.title}</h1>
          <p className="text-small text-foreground-subtle">Última atualização: {formatDate(doc.updatedAt)}</p>
        </header>
        <div className="prose-dreamy mt-10">
          <p>{doc.intro}</p>
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {extra ? <div className="mt-10">{extra}</div> : null}
      </Container>
    </article>
  );
}
