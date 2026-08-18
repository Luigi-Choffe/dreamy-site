import { agentesDeIa as solution } from "@/content/solutions/agentes-de-ia";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = solution.seo.title;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({ eyebrow: solution.name, title: solution.headline, description: solution.description });
}
