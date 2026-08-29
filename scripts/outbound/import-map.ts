/**
 * Mapa de cabeçalhos do export do Clay → campos de Contact.
 *
 * ⚠️ REVISAR A CADA LISTA NOVA DO CLAY (PRD-EMAIL-OUTBOUND §11.2): o Clay muda os
 * cabeçalhos entre runs. Antes de importar, confira os cabeçalhos reais do arquivo
 * (rode com --dry-run e olhe as colunas que caíram em `custom`) e acrescente os
 * aliases que faltarem. A comparação é normalizada (minúsculas, sem acento,
 * espaços colapsados), então "E-Mail" ≡ "e-mail" ≡ "E-MAIL".
 *
 * Colunas de "nome completo" (ex.: "Full Name") NÃO são mapeadas de propósito:
 * {{nome}} nos templates espera só o primeiro nome. Se a lista só tiver nome
 * completo, dividir a coluna antes de importar (ou ajustar aqui conscientemente).
 */
import type { HeaderMapping } from "../../src/lib/outbound/import-core";

export const CLAY_HEADER_MAP: HeaderMapping = {
  email: [
    "email",
    "e-mail",
    "e mail",
    "work email",
    "work e-mail",
    "email address",
    "business email",
    "email corporativo",
    "e-mail corporativo",
    "verified email",
  ],
  nome: ["first name", "first_name", "firstname", "nome", "primeiro nome", "given name"],
  sobrenome: ["last name", "last_name", "lastname", "sobrenome", "surname", "family name"],
  cargo: ["title", "job title", "job_title", "cargo", "position", "role", "função", "funcao", "current title"],
  empresa: [
    "company",
    "company name",
    "company_name",
    "empresa",
    "organization",
    "organisation",
    "organização",
    "current company",
  ],
  dominio: [
    "domain",
    "company domain",
    "website",
    "company website",
    "site",
    "domínio",
    "dominio",
    "url",
    "company url",
  ],
  industria: ["industry", "indústria", "industria", "setor", "sector", "segmento", "company industry"],
  porte: [
    "employees",
    "employee count",
    "number of employees",
    "# employees",
    "company size",
    "headcount",
    "funcionários",
    "funcionarios",
    "porte",
    "tamanho da empresa",
  ],
  linkedin: ["linkedin", "linkedin url", "linkedin profile", "person linkedin url", "perfil linkedin"],
};
