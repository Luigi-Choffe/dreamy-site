import { HeaderClient } from "@/components/layout/HeaderClient";
import { buildNavigation } from "@/config/navigation";
import { whatsappUrl } from "@/config/site";
import { getContentFlags } from "@/lib/content/collections";

/** Header (Server Component): monta a navegação com os gates de conteúdo e delega interação ao client. */
export function Header() {
  const nav = buildNavigation(getContentFlags());
  return <HeaderClient nav={nav} whatsappUrl={whatsappUrl()} />;
}
