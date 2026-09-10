import { describe, expect, it } from "vitest";
import { colegasNaCampanha, normalizeEmpresa } from "@/lib/outbound/ops-core";
import type { Contact, Enrollment } from "@/lib/outbound/types";

function contact(id: string, over: Partial<Contact> = {}): Contact {
  return {
    id,
    email: `${id}@exemplo.com.br`,
    nome: `Nome ${id}`,
    empresa: "Pierserv",
    custom: {},
    importBatchId: "b1",
    verification: "ok",
    status: "active",
    createdAt: "2026-08-20T12:00:00Z",
    ...over,
  };
}

function enrollment(contactId: string, over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: `en-${contactId}`,
    contactId,
    campaignSlug: "logistica",
    status: "active",
    nextStep: 0,
    createdAt: "2026-09-01T12:00:00Z",
    ...over,
  };
}

describe("normalizeEmpresa", () => {
  it("ignora caixa, acento, espaços extras e sufixo societário", () => {
    expect(normalizeEmpresa("  PIERSERV   Ltda. ")).toBe("pierserv");
    expect(normalizeEmpresa("Pierserv S.A.")).toBe("pierserv");
    expect(normalizeEmpresa("Pierserv S/A")).toBe("pierserv");
    expect(normalizeEmpresa("Pierserv - ME")).toBe("pierserv");
    expect(normalizeEmpresa("Pierserv Comércio Ltda ME")).toBe("pierserv comercio");
    expect(normalizeEmpresa("Logística Três Ltda")).toBe("logistica tres");
  });

  it("não faz fuzzy nem come o fim de palavras", () => {
    expect(normalizeEmpresa("PierServ Logística Promocional")).not.toBe(normalizeEmpresa("Pierserv"));
    expect(normalizeEmpresa("Melissa")).toBe("melissa");
    expect(normalizeEmpresa("Acme")).toBe("acme");
  });

  it("vazio/undefined vira string vazia", () => {
    expect(normalizeEmpresa(undefined)).toBe("");
    expect(normalizeEmpresa("   ")).toBe("");
  });
});

describe("colegasNaCampanha", () => {
  const eu = contact("eu", { nome: "Maria Silva" });
  const contacts = [
    eu,
    contact("joao", { nome: "João Pedro", empresa: "PIERSERV LTDA." }),
    contact("ana", { nome: "Ana", empresa: "Pierserv" }),
    contact("outra", { nome: "Carla", empresa: "Outra Empresa" }),
    contact("parou", { nome: "Bruno" }),
    contact("excluido", { nome: "Caio", status: "excluded" }),
    contact("risky", { nome: "Dora", verification: "risky" }),
    contact("outra-camp", { nome: "Elisa" }),
  ];
  const enrollments = [
    enrollment("eu"),
    enrollment("ana", { createdAt: "2026-09-01T12:05:00Z" }),
    enrollment("joao", { createdAt: "2026-09-01T12:01:00Z" }),
    enrollment("outra"),
    enrollment("parou", { status: "replied", stopReason: "reply" }),
    enrollment("excluido"),
    enrollment("risky"),
    enrollment("outra-camp", { campaignSlug: "construcao" }),
  ];

  it("devolve os primeiros nomes dos colegas ativos na mesma campanha, em ordem estável", () => {
    expect(colegasNaCampanha(eu, contacts, enrollments, "logistica")).toEqual(["João", "Ana"]);
  });

  it("não inclui o próprio contato, outra empresa, sequência parada, contato excluído/não verificado nem outra campanha", () => {
    const nomes = colegasNaCampanha(eu, contacts, enrollments, "logistica");
    expect(nomes).not.toContain("Maria");
    expect(nomes).not.toContain("Carla");
    expect(nomes).not.toContain("Bruno");
    expect(nomes).not.toContain("Caio");
    expect(nomes).not.toContain("Dora");
    expect(nomes).not.toContain("Elisa");
  });

  it("contato sem empresa não tem colegas", () => {
    expect(colegasNaCampanha(contact("x", { empresa: undefined }), contacts, enrollments, "logistica")).toEqual([]);
  });

  it("é simétrico: o colega vê o contato de volta", () => {
    const ana = contacts.find((c) => c.id === "ana") as Contact;
    expect(colegasNaCampanha(ana, contacts, enrollments, "logistica")).toEqual(["Maria", "João"]);
  });
});
