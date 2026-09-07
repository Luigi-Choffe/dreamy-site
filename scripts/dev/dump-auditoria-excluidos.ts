/**
 * One-off (READ-ONLY): auditoria dos excluídos por cargo-fora-icp para a campanha
 * "validacao-indicacao". Sem PII de e-mail no stdout (só domínios).
 * Uso: pnpm tsx scripts/dev/dump-auditoria-excluidos.ts
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

const PROVEDORES_PESSOAIS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "yahoo.com",
  "yahoo.com.br",
  "live.com",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "globo.com",
  "ig.com.br",
  "msn.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

const CAMPANHAS_ATIVAS = ["construcao-nova-receita", "obras-sistemas-sob-medida", "engenharia-agentes-ia"];

function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

async function main() {
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, companies, enrollments] = await Promise.all([
    store.contacts(),
    store.companies(),
    store.enrollments(),
  ]);

  const alvo = contacts.filter((c) => c.status === "excluded" && c.excludedReason === "cargo-fora-icp");
  console.log(`ALVO: ${alvo.length} contatos excluded/cargo-fora-icp (total store: ${contacts.length})`);

  const companyByDomain = new Map(companies.map((co) => [co.dominio.toLowerCase(), co]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  console.log("\n=== 1) E-MAIL / DOMÍNIO (por contato, sem endereço) ===");
  for (const c of alvo) {
    const dom = emailDomain(c.email);
    const pessoal = PROVEDORES_PESSOAIS.has(dom);
    const contatoDominio = (c.dominio ?? "").toLowerCase();
    const companyMatch = companyByDomain.has(dom)
      ? "match-companies"
      : companyByDomain.has(contatoDominio)
        ? `email-dom!=contato-dom(${contatoDominio} está em companies)`
        : "SEM company com esse domínio";
    console.log(
      `- ${c.nome} ${c.sobrenome ?? ""} | ${c.cargo ?? "(sem cargo)"} | ${c.empresa ?? "(sem empresa)"} | dom-email=${dom} | pessoal=${pessoal ? "SIM" : "não"} | ${companyMatch} | verif=${c.verification}`,
    );
  }

  console.log("\n=== 3) ABERTURAS (custom.abertura) ===");
  for (const c of alvo) {
    const ab = c.custom?.abertura ?? "";
    console.log(`- ${c.nome} ${c.sobrenome ?? ""} @ ${c.empresa ?? "?"}: ${ab || "(SEM ABERTURA)"}`);
  }

  console.log("\n=== 4) DUPLICATAS DE EMPRESA ENTRE OS 37 ===");
  const porEmpresa = new Map<string, typeof alvo>();
  for (const c of alvo) {
    const key = (c.dominio ?? emailDomain(c.email) ?? c.empresa ?? "?").toLowerCase();
    const arr = porEmpresa.get(key) ?? [];
    arr.push(c);
    porEmpresa.set(key, arr);
  }
  let multi = 0;
  for (const [key, arr] of [...porEmpresa].sort((a, b) => b[1].length - a[1].length)) {
    if (arr.length > 1) {
      multi++;
      console.log(`- ${key} (${arr[0].empresa ?? "?"}): ${arr.length} contatos`);
      for (const c of arr) console.log(`    · ${c.nome} ${c.sobrenome ?? ""} — ${c.cargo ?? "?"}`);
    }
  }
  console.log(`empresas com >1 contato: ${multi} de ${porEmpresa.size} empresas distintas`);

  console.log("\n=== 5) CRUZAMENTO COM CAMPANHAS ATIVAS (decisor na sequência) ===");
  const dominiosAlvo = new Set(alvo.map((c) => (c.dominio ?? emailDomain(c.email)).toLowerCase()).filter(Boolean));
  const overlapPorEmpresa = new Map<string, { decisores: string[]; statuses: string[]; campanhas: Set<string> }>();
  for (const e of enrollments) {
    if (!CAMPANHAS_ATIVAS.includes(e.campaignSlug)) continue;
    const c = contactById.get(e.contactId);
    if (!c) continue;
    const dom = (c.dominio ?? emailDomain(c.email)).toLowerCase();
    if (!dominiosAlvo.has(dom)) continue;
    const entry = overlapPorEmpresa.get(dom) ?? { decisores: [], statuses: [], campanhas: new Set<string>() };
    entry.decisores.push(`${c.nome} ${c.sobrenome ?? ""} — ${c.cargo ?? "?"} [enroll:${e.status}]`);
    entry.statuses.push(e.status);
    entry.campanhas.add(e.campaignSlug);
    overlapPorEmpresa.set(dom, entry);
  }
  console.log(`empresas dos 37 com alguém inscrito nas 3 campanhas: ${overlapPorEmpresa.size}`);
  for (const [dom, entry] of overlapPorEmpresa) {
    const co = companyByDomain.get(dom);
    console.log(`- ${co?.nome ?? dom} (${dom}) | campanhas: ${[...entry.campanhas].join(", ")}`);
    for (const d of entry.decisores) console.log(`    · ${d}`);
  }

  console.log("\n(resumo enrollments nas 3 campanhas)");
  const porCampanha = new Map<string, Map<string, number>>();
  for (const e of enrollments) {
    if (!CAMPANHAS_ATIVAS.includes(e.campaignSlug)) continue;
    const m = porCampanha.get(e.campaignSlug) ?? new Map<string, number>();
    m.set(e.status, (m.get(e.status) ?? 0) + 1);
    porCampanha.set(e.campaignSlug, m);
  }
  for (const [slug, m] of porCampanha) {
    console.log(`  ${slug}: ${[...m].map(([s, n]) => `${s}=${n}`).join(" ")}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

export {};
