"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * Submit com estado pendente (useFormStatus): o botão mostra o spinner do
 * design system enquanto a Server Action roda, evitando clique duplo (que no
 * login dispararia e-mails de acesso duplicados).
 */
export function SubmitButton({ children, loadingLabel = "Enviando" }: { children: ReactNode; loadingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}
