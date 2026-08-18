/** Formata data ISO (YYYY-MM-DD) em pt-BR sem depender do fuso do servidor. */
export function formatDatePtBr(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" },
) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", opts).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
