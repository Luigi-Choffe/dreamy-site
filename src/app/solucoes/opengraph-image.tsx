import { solutionsIndexContent } from "@/content/solutions";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = solutionsIndexContent.seo.title;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgImage({
    eyebrow: "Soluções",
    title: solutionsIndexContent.title,
    description: solutionsIndexContent.intro,
  });
}
