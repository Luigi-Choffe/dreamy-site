"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { LinkButton } from "@/components/ui/Button";
import type { NavigationModel, NavItem } from "@/config/navigation";
import { trackCta } from "@/lib/analytics/events";
import { cn } from "@/lib/utils/cn";

interface HeaderClientProps {
  nav: NavigationModel;
  whatsappUrl: string | null;
}

function isActive(pathname: string, href: string) {
  const clean = href.split("#")[0] || "/";
  if (clean === "/") return pathname === "/";
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

/**
 * Header sticky: fundo discreto no topo, superfície definida + blur após scroll (PRD §14).
 * Dropdown de Soluções acessível (click/teclado; hover apenas como atalho para ponteiro).
 */
export function HeaderClient({ nav, whatsappUrl }: HeaderClientProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow] duration-(--duration-base) ease-(--ease-out)",
        scrolled
          ? "border-b border-border bg-background/85 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container-x flex h-(--header-height) items-center justify-between gap-6">
        <Logo priority fluid width={124} className="w-[104px] sm:w-[124px]" />

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.primary.map((item) =>
              item.children ? (
                <li key={item.label}>
                  <SolutionsDropdown item={item} pathname={pathname} />
                </li>
              ) : (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full px-3.5 text-[0.9375rem] font-medium text-foreground-muted",
                      "transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-foreground",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      "aria-[current=page]:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {pathname !== nav.cta.href ? (
            <LinkButton
              href={nav.cta.href}
              size="sm"
              className="px-3.5 sm:px-4"
              onClick={() => trackCta("header_cta", "header", "contact")}
            >
              {/* PRD §14: CTA presente também no mobile — rótulo curto abaixo de sm */}
              <span className="sm:hidden">{nav.cta.shortLabel ?? nav.cta.label}</span>
              <span className="hidden sm:inline">{nav.cta.label}</span>
            </LinkButton>
          ) : null}
          <button
            type="button"
            aria-label="Abrir menu"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className={cn(
              "grid size-11 place-items-center rounded-full border border-border text-foreground lg:hidden",
              "transition-colors duration-(--duration-fast) hover:bg-surface-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} nav={nav} whatsappUrl={whatsappUrl} />
    </header>
  );
}

function SolutionsDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const closeTimer = useRef<number | null>(null);
  const hoverOpened = useRef(false);
  const active = isActive(pathname, item.href);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(close, 160);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const onKeyDownPanel = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = rootRef.current?.querySelectorAll<HTMLAnchorElement>("[data-dropdown-item]");
    if (!items || items.length === 0) return;
    const list = Array.from(items);
    const idx = list.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(idx + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose();
          if (!open) hoverOpened.current = true;
          setOpen(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") scheduleClose();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => {
          // aberto por hover: o clique confirma (mantém aberto); caso contrário alterna
          if (hoverOpened.current) {
            hoverOpened.current = false;
            setOpen(true);
            return;
          }
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => {
              rootRef.current?.querySelector<HTMLAnchorElement>("[data-dropdown-item]")?.focus();
            });
          }
        }}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-[0.9375rem] font-medium text-foreground-muted",
          "transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          (active || open) && "text-foreground",
        )}
      >
        {item.label}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform duration-(--duration-fast)", open && "rotate-180")}
        />
      </button>

      <div
        id={panelId}
        role="group"
        aria-label={item.label}
        onKeyDown={onKeyDownPanel}
        inert={!open}
        className={cn(
          "absolute top-full left-1/2 z-50 mt-2 w-[26rem] -translate-x-1/2 rounded-xl border border-border bg-surface p-2 shadow-lg",
          "origin-top transition-[opacity,transform] duration-(--duration-fast) ease-(--ease-out)",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        <ul className="flex flex-col">
          {item.children?.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                data-dropdown-item
                onClick={close}
                aria-current={isActive(pathname, child.href) ? "page" : undefined}
                className={cn(
                  "group/item flex items-start justify-between gap-3 rounded-lg px-3.5 py-3",
                  "transition-colors duration-(--duration-fast) hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none",
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[0.9375rem] font-semibold text-foreground">{child.label}</span>
                  {child.description ? (
                    <span className="text-small text-foreground-muted">{child.description}</span>
                  ) : null}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-foreground-subtle transition-[transform,color] group-hover/item:translate-x-0.5 group-hover/item:text-brand-strong"
                />
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1">
            <Link
              href={item.href}
              data-dropdown-item
              onClick={close}
              className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-small font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:outline-none"
            >
              Ver todas as soluções
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
