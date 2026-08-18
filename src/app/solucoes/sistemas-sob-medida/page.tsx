import { SolutionPage } from "@/components/marketing/SolutionPage";
import { routes } from "@/config/site";
import { sistemasSobMedida as solution } from "@/content/solutions/sistemas-sob-medida";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: solution.seo.title,
  description: solution.seo.description,
  path: `${routes.solutions}/${solution.slug}`,
});

export default function Page() {
  return <SolutionPage solution={solution} />;
}
