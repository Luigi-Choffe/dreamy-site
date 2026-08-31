"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import type { EstadoForm } from "./stateful-actions";

/**
 * Form com estado (P1 #5/#7 do plano de melhorias): erro de validação aparece
 * inline SEM perder o que foi digitado; sucesso vira toast (e opcionalmente
 * limpa o form). Os children continuam Server Components; o submit pendente é
 * dos botões internos (useFormStatus).
 */
export function FormComEstado({
  action,
  className,
  resetOnOk = false,
  children,
}: {
  action: (prev: EstadoForm | null, formData: FormData) => Promise<EstadoForm>;
  className?: string;
  /** Limpar os campos após sucesso (criações; nunca em edição de valores atuais). */
  resetOnOk?: boolean;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast({ variant: "success", title: state.ok });
      if (resetOnOk) ref.current?.reset();
    }
  }, [state, resetOnOk, toast]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-xs font-semibold text-error">
          {state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}
