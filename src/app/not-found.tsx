import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";
import { notFoundContent } from "@/content/not-found";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "Página não encontrada | Dreamy",
  description: "Parece que esta página não existe.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <Section className="flex min-h-[60vh] items-center">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="eyebrow">Erro 404</p>
        <h1 className="font-display text-h1 font-bold text-balance">{notFoundContent.title}</h1>
        <p className="measure text-lead text-foreground-muted">{notFoundContent.text}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <LinkButton href={notFoundContent.primary.href}>{notFoundContent.primary.label}</LinkButton>
          <LinkButton href={notFoundContent.secondary.href} variant="secondary">
            {notFoundContent.secondary.label}
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
