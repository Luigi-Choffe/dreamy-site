"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Primitivos de feedback dos formulários do console (achados da auditoria de
 * usabilidade): todo submit mostra estado pendente e bloqueia duplo clique;
 * ação permanente exige um segundo clique de confirmação NA TELA (não em
 * tooltip). Todos dependem de useFormStatus, então vivem DENTRO do <form>.
 */

/** Submit em pílula (fila do dia, tabelas): pending = desabilita + rótulo. */
export function PendingPill({
  className,
  children,
  pendingLabel = "Salvando…",
  title,
}: {
  className?: string;
  children: ReactNode;
  pendingLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      title={title}
      className={cn(className, pending && "cursor-progress opacity-60")}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Submit no design system (Button + spinner): para os forms maiores. */
export function SubmitButton({
  children,
  loadingLabel = "Salvando",
  ...props
}: ButtonProps & { loadingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingLabel={loadingLabel} {...props}>
      {children}
    </Button>
  );
}

/**
 * Ação permanente em duas etapas: o primeiro clique arma ("Confirmar…" visível
 * na tela por alguns segundos), o segundo submete de verdade. Sem confirm()
 * nativo e sem depender de tooltip.
 */
export function ConfirmSubmit({
  className,
  children,
  confirmLabel,
  pendingLabel = "Suprimindo…",
  title,
}: {
  className?: string;
  children: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), 5000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [armed]);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      title={title}
      onClick={(e) => {
        if (!armed && !pending) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className={cn(className, armed && "bg-error text-white hover:bg-error", pending && "cursor-progress opacity-60")}
    >
      {pending ? pendingLabel : armed ? confirmLabel : children}
    </button>
  );
}
