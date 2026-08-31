"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * Select de filtro que aplica sozinho: trocar o valor submete o form GET
 * (achado da auditoria de usabilidade: filtrar exigia dois passos). O botão
 * Filtrar continua no form como fallback sem JS e para a busca por texto.
 */
export function FiltroSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
