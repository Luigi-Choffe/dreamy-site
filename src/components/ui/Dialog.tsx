"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Oculta visualmente o título (mantém acessível). */
  hideTitle?: boolean;
  description?: string;
  children: ReactNode;
  className?: string;
  /** `panel` (centralizado) | `sheet` (tela cheia no mobile, painel à direita no desktop) */
  variant?: "panel" | "sheet";
  closeLabel?: string;
  /** Elemento que recebe foco ao abrir (por padrão, o botão de fechar). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Dialog modal acessível baseado no elemento nativo <dialog>:
 * focus trap, ESC, backdrop e restauração de foco são fornecidos pelo navegador.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  className,
  variant = "panel",
  closeLabel = "Fechar",
  initialFocusRef,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.style.overflow = "hidden";
      const target = initialFocusRef?.current ?? closeRef.current;
      target?.focus();
    } else if (!open && el.open) {
      el.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const handleClose = () => {
      document.documentElement.style.overflow = "";
      if (open) onClose();
    };
    el.addEventListener("cancel", handleCancel);
    el.addEventListener("close", handleClose);
    return () => {
      el.removeEventListener("cancel", handleCancel);
      el.removeEventListener("close", handleClose);
    };
  }, [onClose, open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        // clique no backdrop fecha
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-0 hidden max-h-none max-w-none bg-transparent p-0 text-foreground backdrop:bg-overlay backdrop:backdrop-blur-[2px]",
        "open:animate-fade-in",
        variant === "panel" && "fixed inset-0 h-full w-full place-items-center p-4 open:grid",
        variant === "sheet" && "fixed inset-0 h-full w-full open:block",
      )}
    >
      <div
        className={cn(
          "relative flex flex-col bg-surface text-foreground shadow-lg",
          variant === "panel" &&
            "w-full max-w-lg rounded-xl border border-border p-6 motion-safe:animate-rise-in md:p-8",
          variant === "sheet" &&
            "ml-auto h-full w-full max-w-md overflow-y-auto border-l border-border p-6 motion-safe:animate-fade-in sm:p-8",
          className,
        )}
      >
        <div className={cn("flex items-start justify-between gap-4", hideTitle ? "mb-2" : "mb-5")}>
          <h2 id={titleId} className={cn("font-display text-h3 font-bold", hideTitle && "sr-only")}>
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn(
              "ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-border text-foreground-muted",
              "transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            )}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {description ? (
          <p id={descId} className="mb-5 text-small text-foreground-muted">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
