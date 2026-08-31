"use client";

import { useMemo, useState } from "react";

/**
 * Combobox leve para escolher contato (P1 #6 do plano de melhorias): um campo
 * de filtro reduz as opções do select nativo enquanto digita. O select mantém
 * o mesmo name no submit e continua funcionando sem filtro. Sem lib externa.
 * PII: os rótulos são nome/empresa; e-mail não aparece.
 */

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ComboContato({
  id,
  name,
  options,
  controlClass,
  placeholder = "selecione o contato…",
}: {
  id: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  controlClass: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qF = fold(q.trim());
    if (!qF) return options;
    return options.filter((o) => fold(o.label).includes(qF));
  }, [q, options]);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="digite para filtrar por nome ou empresa"
        aria-label="Filtrar contatos"
        className={controlClass}
      />
      <select id={id} name={name} required defaultValue="" className={controlClass}>
        <option value="" disabled>
          {filtered.length === 0 ? "nenhum contato com esse filtro" : placeholder}
        </option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {q && filtered.length > 0 ? (
        <p className="text-xs text-foreground-subtle tabular-nums">
          {filtered.length} de {options.length} contatos no filtro
        </p>
      ) : null}
    </div>
  );
}
