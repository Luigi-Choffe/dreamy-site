"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "info" | "success" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms; 0 = persistente até fechar */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}

const icons: Record<ToastVariant, typeof Info> = { info: Info, success: CheckCircle2, error: CircleAlert };

/**
 * Toaster leve com região aria-live (polite; assertive para erros).
 * Sem dependências. Fecha por botão, ESC ou tempo (pausa no hover/focus).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const toast = useCallback((opts: ToastOptions) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, duration: 6000, variant: "info", ...opts }]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = icons[item.variant ?? "info"];

  useEffect(() => {
    if (!item.duration || paused) return;
    const t = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, paused, onDismiss]);

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => e.key === "Escape" && onDismiss()}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface p-4 shadow-lg motion-safe:animate-rise-in",
        item.variant === "error" ? "border-error/40" : "border-border",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-5 shrink-0",
          item.variant === "success" && "text-success",
          item.variant === "error" && "text-error",
          item.variant === "info" && "text-brand-strong",
        )}
      />
      <div className="flex-1 text-small">
        <p className="font-semibold text-foreground">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-foreground-muted">{item.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="grid size-8 shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
