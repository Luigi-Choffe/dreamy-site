import { LegalDocument } from "@/components/content/LegalDocument";
import { routes } from "@/config/site";
import { getPrivacyPolicy } from "@/content/legal/privacy";
import { createPageMetadata } from "@/lib/seo/metadata";

const doc = getPrivacyPolicy();

export const metadata = createPageMetadata({
  title: doc.seo.title,
  description: doc.seo.description,
  path: routes.privacy,
});

export default function PrivacyPage() {
  return <LegalDocument doc={doc} path={routes.privacy} />;
}
