import { aboutContent } from "@/content/about";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = aboutContent.seo.title;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({
    eyebrow: "Sobre a Dreamy",
    title: aboutContent.title,
    description: aboutContent.paragraphs[0],
  });
}
