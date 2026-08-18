import { contactContent } from "@/content/contact";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = contactContent.seo.title;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({ eyebrow: "Contato", title: contactContent.title, description: contactContent.intro });
}
