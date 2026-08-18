import { Accordion } from "@/components/ui/Accordion";
import type { FaqItem } from "@/content/types";

/** FAQ (PRD §25) — accordion acessível; conteúdo no HTML para SEO. */
export function FAQ({ items }: { items: FaqItem[] }) {
  return (
    <Accordion
      items={items.map((item) => ({ id: item.question, title: item.question, content: <p>{item.answer}</p> }))}
    />
  );
}
