"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { LinkButton } from "@/components/ui/Button";
import type { NavigationModel } from "@/config/navigation";
import { trackCta } from "@/lib/analytics/events";
import { cn } from "@/lib/utils/cn";

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
  nav: NavigationModel;
  whatsappUrl: string | null;
}

/**
 * Menu mobile acessível: <dialog> modal (focus trap/ESC nativos), lista completa,
 * soluções expandidas inline (sem depender de hover), CTA sempre visível.
 */
export function MobileNavigation({ open, onClose, nav, whatsappUrl }: MobileNavigationProps) {
  const pathname = usePathname();

  return (
    <Dialog open={open} onClose={onClose} title="Menu" hideTitle variant="sheet" closeLabel="Fechar menu">
      <nav aria-label="Navegação principal (mobile)" className="flex flex-1 flex-col">
        <ul className="flex flex-col divide-y divide-border">
          {nav.primary.map((item) => (
            <li key={item.label} className="py-2">
              {item.children ? (
                <div>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center justify-between py-3 font-display text-h4 font-semibold text-foreground"
                  >
                    {item.label}
                    <ArrowUpRight aria-hidden="true" className="size-5 text-foreground-subtle" />
                  </Link>
                  <ul className="mb-2 flex flex-col gap-1 pl-3">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onClose}
                          aria-current={pathname === child.href ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-md py-2.5 pr-2 pl-3 text-base text-foreground-muted",
                            "border-l-2 border-border transition-colors hover:border-brand-strong hover:text-foreground",
                            "aria-[current=page]:border-brand-strong aria-[current=page]:text-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={pathname === item.href.split("#")[0] && !item.href.includes("#") ? "page" : undefined}
                  className="flex items-center justify-between py-3 font-display text-h4 font-semibold text-foreground"
                >
                  {item.label}
                  <ArrowUpRight aria-hidden="true" className="size-5 text-foreground-subtle" />
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <LinkButton
            href={nav.cta.href}
            size="lg"
            className="w-full"
            onClick={() => {
              trackCta("mobile_menu_cta", "mobile_menu", "contact");
              onClose();
            }}
          >
            {nav.cta.label}
          </LinkButton>
          {whatsappUrl ? (
            <LinkButton
              href={whatsappUrl}
              external
              variant="secondary"
              size="lg"
              className="w-full"
              leadingIcon={<MessageCircle className="size-4" aria-hidden="true" />}
              onClick={() => trackCta("mobile_menu_whatsapp", "mobile_menu", "whatsapp")}
            >
              Falar pelo WhatsApp
            </LinkButton>
          ) : null}
        </div>
      </nav>
    </Dialog>
  );
}
