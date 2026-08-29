import { describe, expect, it } from "vitest";
import {
  cleanDomain,
  isPersonalEmail,
  mapRows,
  matchesTargetRole,
  normalizeHeader,
  prepareImport,
  type HeaderMapping,
} from "@/lib/outbound/import-core";
import { CLAY_HEADER_MAP } from "../../scripts/outbound/import-map";

const MAPPING: HeaderMapping = {
  email: ["email", "work email"],
  nome: ["first name", "nome"],
  sobrenome: ["last name"],
  cargo: ["job title", "cargo"],
  empresa: ["company"],
  dominio: ["domain"],
  industria: ["industry"],
  porte: ["employees"],
  linkedin: ["linkedin url"],
};

describe("normalizeHeader / cleanDomain", () => {
  it("normaliza cabeçalhos: trim, minúsculas, sem acento, espaços colapsados", () => {
    expect(normalizeHeader("  E-Mail  ")).toBe("e-mail");
    expect(normalizeHeader("Indústria")).toBe("industria");
    expect(normalizeHeader("FUNÇÃO   ATUAL")).toBe("funcao atual");
  });

  it("limpa domínio: protocolo, www e caminho", () => {
    expect(cleanDomain("https://www.Empresa.com.br/sobre?x=1")).toBe("empresa.com.br");
    expect(cleanDomain("empresa.com.br")).toBe("empresa.com.br");
  });
});

describe("mapRows", () => {
  it("mapeia campos por alias (case/acento-insensitive) e joga o resto em custom", () => {
    const rows = mapRows(
      ["Work Email", "First Name", "Job Title", "Abertura Personalizada", "Fonte do Dado"],
      [["ana@x.com.br", "Ana", "CEO", "Vi seu post sobre ERP", "Apollo"]],
      MAPPING,
    );
    expect(rows[0]!.fields).toEqual({ email: "ana@x.com.br", nome: "Ana", cargo: "CEO" });
    expect(rows[0]!.custom).toEqual({ "abertura personalizada": "Vi seu post sobre ERP", "fonte do dado": "Apollo" });
    expect(rows[0]!.rowNumber).toBe(2); // linha 1 é o cabeçalho
  });

  it("omite valores vazios e tolera linha mais curta que o cabeçalho", () => {
    const rows = mapRows(["Email", "First Name", "Job Title"], [["ana@x.com.br", "  "]], MAPPING);
    expect(rows[0]!.fields).toEqual({ email: "ana@x.com.br" });
    expect(rows[0]!.custom).toEqual({});
  });

  it("o mapa default do Clay cobre os cabeçalhos típicos de um export", () => {
    const rows = mapRows(
      ["Work Email", "First Name", "Last Name", "Job Title", "Company Name", "Industry", "# Employees", "Domain"],
      [["ana@x.com.br", "Ana", "Souza", "CEO", "Empresa X", "Distribuição", "120", "x.com.br"]],
      CLAY_HEADER_MAP,
    );
    expect(rows[0]!.fields).toEqual({
      email: "ana@x.com.br",
      nome: "Ana",
      sobrenome: "Souza",
      cargo: "CEO",
      empresa: "Empresa X",
      industria: "Distribuição",
      porte: "120",
      dominio: "x.com.br",
    });
    expect(rows[0]!.custom).toEqual({});
  });
});

describe("filtros de ICP", () => {
  it("reconhece e-mail pessoal (provedores BR inclusos)", () => {
    expect(isPersonalEmail("x@gmail.com")).toBe(true);
    expect(isPersonalEmail("x@uol.com.br")).toBe(true);
    expect(isPersonalEmail("x@empresa.com.br")).toBe(false);
  });

  it("casa cargos-alvo com flexão e sem falso positivo por substring", () => {
    expect(matchesTargetRole("CEO")).toBe(true);
    expect(matchesTargetRole("Sócio-Fundador")).toBe(true);
    expect(matchesTargetRole("Diretora de Operações")).toBe(true); // flexão feminina
    expect(matchesTargetRole("Head of Growth")).toBe(true);
    expect(matchesTargetRole("VP de Vendas")).toBe(true);
    expect(matchesTargetRole("Gerente Geral")).toBe(true);
    expect(matchesTargetRole("Analista de Marketing")).toBe(false);
    expect(matchesTargetRole("Gerente de Contas")).toBe(false); // "gerente" só vale em "gerente geral"
    expect(matchesTargetRole("Especialista em VPN")).toBe(false); // "vp" não casa em "vpn"
  });

  it("aceita lista de cargos-alvo customizada", () => {
    expect(matchesTargetRole("Coordenador de TI", ["coordenador"])).toBe(true);
    expect(matchesTargetRole("CEO", ["coordenador"])).toBe(false);
  });
});

describe("prepareImport", () => {
  const headers = ["Email", "First Name", "Last Name", "Job Title", "Company", "Industry", "Notas"];
  const rows = [
    ["ana@empresa.com.br", "Ana", "Souza", "CEO", "Empresa X", "Distribuição", "gosta de café"],
    ["bob@gmail.com", "Bob", "", "Founder", "Bobs", "Serviços", ""],
    ["carla@fabrica.ind.br", "Carla", "", "Analista de Marketing", "Fábrica", "Indústria", ""],
    ["dan@firma.com.br", "Dan", "", "", "Firma", "Serviços", ""],
    ["  ANA@Empresa.com.br  ", "Ana", "", "CEO", "Empresa X", "Distribuição", ""], // duplicada (case/trim)
    ["fred@velho.com.br", "Fred", "", "CTO", "Velha", "Saúde", ""], // já existe no store
    ["gia@nova.com.br", "Gia", "", "Diretora Comercial", "Nova", "Saúde", ""],
    ["hugo@sai.com.br", "Hugo", "", "CEO", "Sai", "Saúde", ""], // suprimido (opt-out prévio)
    ["nao-e-email", "Iva", "", "CEO", "Iva Co", "Saúde", ""],
    ["ze@semnome.com.br", "", "", "CEO", "Sem Nome", "Saúde", ""],
  ];

  function run() {
    let seq = 0;
    return prepareImport({
      headers,
      rows,
      mapping: MAPPING,
      batchId: "batch-1",
      existingEmails: new Set(["fred@velho.com.br"]),
      suppressedEmails: new Set(["hugo@sai.com.br"]),
      now: new Date("2026-08-27T12:00:00Z"),
      makeId: () => `c${++seq}`,
    });
  }

  it("classifica linhas: ativos, excluídos com motivo, suprimidos, duplicados e inválidos", () => {
    const result = run();
    const byEmail = new Map(result.contacts.map((c) => [c.email, c]));

    expect(byEmail.get("ana@empresa.com.br")?.status).toBe("active");
    expect(byEmail.get("bob@gmail.com")).toMatchObject({ status: "excluded", excludedReason: "email-pessoal" });
    expect(byEmail.get("carla@fabrica.ind.br")).toMatchObject({ status: "excluded", excludedReason: "cargo-fora-icp" });
    expect(byEmail.get("dan@firma.com.br")?.status).toBe("active"); // sem cargo = warning, não exclusão
    expect(byEmail.get("gia@nova.com.br")?.status).toBe("active");
    expect(byEmail.get("hugo@sai.com.br")?.status).toBe("suppressed"); // nunca reentra como active
    expect(byEmail.has("fred@velho.com.br")).toBe(false); // duplicado do store não é recriado

    expect(result.warnings).toEqual([
      { rowNumber: 5, email: "dan@firma.com.br", detail: "contato sem cargo — revisar ICP manualmente" },
    ]);
    expect(result.duplicatesInBatch).toEqual([
      { rowNumber: 6, email: "ana@empresa.com.br", detail: "e-mail repetido no lote" },
    ]);
    expect(result.duplicatesExisting).toEqual([
      { rowNumber: 7, email: "fred@velho.com.br", detail: "contato já existe no store" },
    ]);
    expect(result.invalid.map((i) => i.rowNumber)).toEqual([10, 11]);
  });

  it("normaliza e-mail, preenche metadados do lote e mantém colunas extras em custom", () => {
    const result = run();
    const ana = result.contacts.find((c) => c.email === "ana@empresa.com.br")!;
    expect(ana).toMatchObject({
      nome: "Ana",
      sobrenome: "Souza",
      cargo: "CEO",
      empresa: "Empresa X",
      industria: "Distribuição",
      custom: { notas: "gosta de café" },
      importBatchId: "batch-1",
      verification: "unverified",
      createdAt: "2026-08-27T12:00:00.000Z",
    });
    // todo contato novo entra unverified — verificação é etapa separada (outbound:verify)
    expect(result.contacts.every((c) => c.verification === "unverified")).toBe(true);
  });

  it("agrega estatísticas para o relatório do lote (PRD §11.8)", () => {
    const { stats } = run();
    expect(stats).toMatchObject({
      totalRows: 10,
      imported: 3, // ana, dan, gia
      excluded: { "email-pessoal": 1, "cargo-fora-icp": 1 },
      suppressed: 1,
      duplicatesInBatch: 1,
      duplicatesExisting: 1,
      invalid: 2,
    });
    // empates de contagem têm ordem lexicográfica — comparar como conjunto evita flakiness de locale
    expect(stats.byIndustria).toHaveLength(3);
    expect(stats.byIndustria).toEqual(
      expect.arrayContaining([
        { label: "Distribuição", count: 1 },
        { label: "Saúde", count: 1 },
        { label: "Serviços", count: 1 },
      ]),
    );
    expect(stats.topCargos).toHaveLength(3);
    expect(stats.topCargos).toEqual(
      expect.arrayContaining([
        { label: "(sem cargo)", count: 1 },
        { label: "CEO", count: 1 },
        { label: "Diretora Comercial", count: 1 },
      ]),
    );
  });
});
