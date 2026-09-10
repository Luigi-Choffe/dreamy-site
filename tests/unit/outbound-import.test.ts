import { describe, expect, it } from "vitest";
import {
  cleanDomain,
  describeRoleFilter,
  isPersonalEmail,
  mapRows,
  matchesTargetRole,
  normalizeHeader,
  parseRoleFilter,
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

  it("parseRoleFilter: ausente = default, all = sem filtro, lista por vírgula = custom", () => {
    expect(parseRoleFilter(undefined)).toBeUndefined();
    expect(parseRoleFilter("all")).toBe("all");
    expect(parseRoleFilter(" ALL ")).toBe("all");
    expect(parseRoleFilter("gerente, coordenador ,supervisor,")).toEqual(["gerente", "coordenador", "supervisor"]);
    expect(() => parseRoleFilter("")).toThrow(/--roles vazio/);
    expect(() => parseRoleFilter(" , ")).toThrow(/--roles vazio/);
  });

  it("describeRoleFilter: rótulo do relatório", () => {
    expect(describeRoleFilter(undefined)).toBe("padrão");
    expect(describeRoleFilter("all")).toBe("todos");
    expect(describeRoleFilter(["gerente", "coordenador"])).toBe("custom (2)");
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

describe("prepareImport: filtro de cargo (--roles)", () => {
  const headers = ["Email", "First Name", "Job Title"];
  const rows = [
    ["ana@empresa.com.br", "Ana", "CEO"],
    ["gil@log.com.br", "Gil", "Gerente de Logística"],
    ["cid@log.com.br", "Cid", "Coordenador de Expedição"],
    ["sue@log.com.br", "Sue", "Supervisora de Armazém"],
    ["dan@firma.com.br", "Dan", ""],
    ["bob@gmail.com", "Bob", "Gerente de Logística"],
  ];

  function statusMap(targetRoles?: Parameters<typeof prepareImport>[0]["targetRoles"]) {
    const result = prepareImport({ headers, rows, mapping: MAPPING, batchId: "b", targetRoles });
    return {
      result,
      status: Object.fromEntries(
        result.contacts.map((c) => [c.email, `${c.status}${c.excludedReason ? `:${c.excludedReason}` : ""}`]),
      ),
    };
  }

  it("default (flag ausente): gerente/coordenador/supervisor seguem fora do ICP", () => {
    const { result, status } = statusMap(undefined);
    expect(status).toEqual({
      "ana@empresa.com.br": "active",
      "gil@log.com.br": "excluded:cargo-fora-icp",
      "cid@log.com.br": "excluded:cargo-fora-icp",
      "sue@log.com.br": "excluded:cargo-fora-icp",
      "dan@firma.com.br": "active",
      "bob@gmail.com": "excluded:email-pessoal",
    });
    expect(result.stats.excluded).toEqual({ "email-pessoal": 1, "cargo-fora-icp": 3 });
  });

  it('"all": nenhum cargo é excluído; sem cargo segue como aviso; e-mail pessoal continua excluído', () => {
    const { result, status } = statusMap("all");
    expect(status).toEqual({
      "ana@empresa.com.br": "active",
      "gil@log.com.br": "active",
      "cid@log.com.br": "active",
      "sue@log.com.br": "active",
      "dan@firma.com.br": "active",
      "bob@gmail.com": "excluded:email-pessoal",
    });
    expect(result.stats.imported).toBe(5);
    expect(result.stats.excluded).toEqual({ "email-pessoal": 1, "cargo-fora-icp": 0 });
    expect(result.warnings.map((w) => w.email)).toEqual(["dan@firma.com.br"]);
  });

  it("lista custom substitui as palavras-chave padrão (CEO passa a ficar fora)", () => {
    const { result, status } = statusMap(["gerente", "coordenador", "supervisor"]);
    expect(status).toEqual({
      "ana@empresa.com.br": "excluded:cargo-fora-icp",
      "gil@log.com.br": "active",
      "cid@log.com.br": "active",
      "sue@log.com.br": "active", // flexão feminina: supervisor → supervisora
      "dan@firma.com.br": "active",
      "bob@gmail.com": "excluded:email-pessoal",
    });
    expect(result.stats.excluded).toEqual({ "email-pessoal": 1, "cargo-fora-icp": 1 });
  });

  it("lista vazia é erro explícito (não exclui todo mundo em silêncio)", () => {
    expect(() => statusMap([])).toThrow(/targetRoles vazio/);
  });
});
