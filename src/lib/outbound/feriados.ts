/**
 * Feriados nacionais do Brasil (tabela explícita, sem algoritmo de Páscoa).
 *
 * Regra do motor: feriado nacional é tratado como sábado/domingo. O plano do dia
 * bloqueia com o motivo "feriado nacional: <nome>" e a Agenda pula o dia na
 * previsão. Incidente que motivou: 07/09/2026 (Independência) saiu ciclo normal.
 *
 * Datas móveis conferidas a partir da Páscoa (2026: 05/04 · 2027: 28/03):
 *   Carnaval seg/ter = Páscoa − 48/−47 dias · Sexta-feira Santa = Páscoa − 2 ·
 *   Corpus Christi = Páscoa + 60. Feriados municipais/estaduais NÃO entram
 *   (a base é nacional). Renovar a tabela antes do fim de 2027: sem entrada
 *   para o ano, o motor volta a considerar só o fim de semana.
 */

export const FERIADOS_NACIONAIS: Readonly<Record<string, string>> = {
  // 2026
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval (segunda-feira)",
  "2026-02-17": "Carnaval (terça-feira)",
  "2026-04-03": "Sexta-feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-09-07": "Independência do Brasil",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Dia da Consciência Negra",
  "2026-12-25": "Natal",
  // 2027
  "2027-01-01": "Confraternização Universal",
  "2027-02-08": "Carnaval (segunda-feira)",
  "2027-02-09": "Carnaval (terça-feira)",
  "2027-03-26": "Sexta-feira Santa",
  "2027-04-21": "Tiradentes",
  "2027-05-01": "Dia do Trabalho",
  "2027-05-27": "Corpus Christi",
  "2027-09-07": "Independência do Brasil",
  "2027-10-12": "Nossa Senhora Aparecida",
  "2027-11-02": "Finados",
  "2027-11-15": "Proclamação da República",
  "2027-11-20": "Dia da Consciência Negra",
  "2027-12-25": "Natal",
};

/** Nome do feriado nacional na data-calendário (YYYY-MM-DD, fuso de envio), ou null. */
export function feriadoNacional(dateKey: string): string | null {
  return FERIADOS_NACIONAIS[dateKey] ?? null;
}
