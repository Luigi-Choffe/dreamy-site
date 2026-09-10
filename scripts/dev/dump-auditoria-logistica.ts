/**
 * One-off (READ-ONLY): auditoria do lote de LOGÍSTICA (contatos ativos, industria = "logística")
 * para a campanha nova. Sem PII de e-mail no stdout (só domínios).
 * Uso: pnpm tsx scripts/dev/dump-auditoria-logistica.ts [--out <arquivo.json>]
 *   --out grava um JSON com o material de personalização (sem e-mail) para leitura humana.
 *
 * As decisões (ICP de empresa, classe de cargo, cesta da onda 1) foram tomadas pelo GARIMPO
 * lendo headline/summary de cada contato em 2026-09-10 e estão codificadas abaixo para que o
 * relatório seja reproduzível. Nada aqui altera o store.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local — vale a env do shell
}

import fs from "node:fs/promises";

function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

/** Chave de empresa unificada por grafia (Pierserv × PierServ Logística Promocional etc.). */
function companyKey(empresa: string): string {
  const e = empresa.toLowerCase();
  if (e.includes("pierserv")) return "PierServ Logística Promocional";
  if (e.includes("polar")) return "Grupo Polar";
  if (e.includes("biothermal") || e.startsWith("bls")) return "BLS - Biothermal Logistics Solutions";
  if (e.includes("furlong")) return "Transportes Furlong do Brasil";
  if (e.includes("pelog")) return "Pelog Soluções Logísticas";
  if (e.startsWith("ags")) return "AGS Global Logistics";
  if (e.includes("spare")) return "Spare Partners - MRO Solutions";
  return empresa.trim();
}

/** Decisão de ICP por empresa (unificada). */
type Icp = "fica" | "sai" | "angulo";
const ICP_EMPRESA: Record<string, { icp: Icp; motivo: string }> = {
  "AESA Empilhadeiras ltda": {
    icp: "sai",
    motivo: "fornecedor/locadora de empilhadeiras, não opera logística para terceiros",
  },
  "Neolider Tubos e Conexões de Aço": {
    icp: "sai",
    motivo: "distribuidor de tubos e aço (materiais de construção); nenhum contato de logística",
  },
  HospLog: {
    icp: "sai",
    motivo: "logística hospitalar interna de cooperativa de saúde (domínio unimedcampinas); não é operador",
  },
  "Zenatur ZT": {
    icp: "angulo",
    motivo:
      "fretamento/transporte de passageiros com bases operacionais; não é carga. Ângulo: frota e bases, não galpão",
  },
  "Grupo Polar": {
    icp: "angulo",
    motivo:
      "fornecedor de soluções de cadeia fria (embalagens térmicas, qualificação, e-commerce próprio; 7 empresas); não é operador. Ângulo: indústria com estoque e e-commerce",
  },
  "Grupo Prime": {
    icp: "fica",
    motivo: "Prime Cargo: transportadora expressa com foco hospitalar/cirúrgico, tracking aéreo e rodoviário",
  },
  "Spare Partners - MRO Solutions": {
    icp: "fica",
    motivo:
      "operador de almoxarifado/logística MRO para indústria e mineração (WMS SAP, multissites): o ângulo mais próximo do case de estoque",
  },
};

/** Classe de cargo: a decisor, b operacional que vive a dor, c comercial/CS, d fora da conversa. */
type Classe = "a" | "b" | "c" | "d";
/** onda: 1 = cesta da onda 1, 2 = reserva, 0 = sair. flag = anomalia a checar. */
interface Decisao {
  classe: Classe;
  onda: 0 | 1 | 2;
  flag?: string;
}
const D: Record<string, Decisao> = {
  // AESA (empresa sai)
  "César Rodrigues|AESA Empilhadeiras ltda": { classe: "b", onda: 0 },
  // Affinity
  "Simone Oliveira|Affinity Logística Internacional": { classe: "a", onda: 1 },
  "Philippe Muls|Affinity Logística Internacional": { classe: "c", onda: 1 },
  "Luiz Cid|Affinity Logística Internacional": {
    classe: "b",
    onda: 2,
    flag: "domínio onelogbrasil; headline diz Diretor na One Log do Brasil (outra empresa)",
  },
  // AGS
  "Alexandre Gulla|AGS Global Logistics": { classe: "a", onda: 1 },
  "Roni Conrado|AGS Global Logistics": { classe: "b", onda: 1 },
  "Leandro Ferreira|AGS Global Logistics": { classe: "b", onda: 1 },
  "Michel Matar|AGS Global Logistics": { classe: "a", onda: 1 },
  "Diego Medeiros|AGS Global Logistics": { classe: "a", onda: 2, flag: "conselheiro consultivo externo, não opera" },
  // AUTLOG
  "Cleyton Santos|AUTLOG - Logística Promocional": { classe: "b", onda: 1 },
  "Vinicius Frois|AUTLOG - Logística Promocional": { classe: "b", onda: 1 },
  "Cristiano Martins|AUTLOG - Logística Promocional": { classe: "d", onda: 0 },
  // Bahia Sul
  "Fernando Batista|Bahia Sul Transportes e Logística": { classe: "a", onda: 1 },
  "Pablo Oliveira|Bahia Sul Transportes e Logística": { classe: "b", onda: 1 },
  // BLS
  "Fabio Martins|BLS - Biothermal Logistics Solutions": {
    classe: "a",
    onda: 1,
    flag: "domínio cryoforlife.com (outra empresa do fundador?); se cair, promover Danilo",
  },
  "Aline de Oliveira|BLS - Biothermal Logistics Solutions": { classe: "a", onda: 1 },
  "Andreia do N. Secco|BLS - Biothermal Logistics Solutions": { classe: "b", onda: 1 },
  "Renato Kubota|BLS - Biothermal Logistics Solutions": { classe: "b", onda: 1 },
  "Danilo Xafranski|BLS - Biothermal Logistics Solutions": { classe: "b", onda: 2 },
  "Luciano Fagundes|BLS - Biothermal Logistics Solutions": { classe: "b", onda: 2 },
  "Candido Silva|BLS - Biothermal Logistics Solutions": { classe: "c", onda: 2 },
  "Adalberto Ribeiro|BLS - Biothermal Logistics Solutions": {
    classe: "d",
    onda: 0,
    flag: "domínio multicarepharma.com (distribuidora de medicamentos, outra empresa)",
  },
  // De Santa
  "Sidney Martins|De Santa Transporte": { classe: "b", onda: 1 },
  // Difalux
  "Ivani da Cunha|Difalux Transportes": { classe: "c", onda: 1 },
  "Meire Carvalho|Difalux Transportes": { classe: "d", onda: 0 },
  // ELO
  "Peter Dal Negro|ELO Soluções Logísticas Integradas": { classe: "a", onda: 1 },
  "Paulo Tucolki|ELO Soluções Logísticas Integradas": { classe: "b", onda: 1 },
  "André Galão|ELO Soluções Logísticas Integradas": { classe: "b", onda: 1 },
  "Uelinton Alves|ELO Soluções Logísticas Integradas": { classe: "a", onda: 1 },
  "Eduardo Bueno|ELO Soluções Logísticas Integradas": { classe: "a", onda: 2 },
  "Samuel Santos|ELO Soluções Logísticas Integradas": {
    classe: "a",
    onda: 2,
    flag: "domínio opmaster.com.br; headline Head de Logística e Comex (outra empresa?)",
  },
  "Joao Soares|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "José Ricardo|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "Raphael de Oliveira Souza|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "Ingrid Medina|ELO Soluções Logísticas Integradas": {
    classe: "b",
    onda: 2,
    flag: "domínio mail.elo.com.br (subdomínio diferente dos 14 elo.log.br)",
  },
  "Andre dos Santos|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "Rafael Araujo|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "Ramecli Silva|ELO Soluções Logísticas Integradas": { classe: "b", onda: 2 },
  "Anderson Lemos|ELO Soluções Logísticas Integradas": { classe: "c", onda: 2 },
  "Steven Claudino|ELO Soluções Logísticas Integradas": { classe: "c", onda: 2 },
  "Igor M.|ELO Soluções Logísticas Integradas": { classe: "d", onda: 0 },
  // FATELOG
  "Gabriel Couto|FATELOG TRANSPORTES E LOGÍSTICA": { classe: "a", onda: 1 },
  "Diego Leite|FATELOG TRANSPORTES E LOGÍSTICA": { classe: "b", onda: 1 },
  "Cristiano Santana|FATELOG TRANSPORTES E LOGÍSTICA": { classe: "b", onda: 1 },
  "Jefferson Felipe|FATELOG TRANSPORTES E LOGÍSTICA": { classe: "b", onda: 1 },
  "Bruno Frey|FATELOG TRANSPORTES E LOGÍSTICA": {
    classe: "a",
    onda: 2,
    flag: "headline cita Fita Azul Transportes (grupo?)",
  },
  // FKS
  "Marco Franco|FKS Logistics": { classe: "b", onda: 1 },
  "Greice Souza|FKS Logistics": { classe: "d", onda: 0 },
  // Golden Cargo
  "João de Sousa Lina|Golden Cargo": { classe: "b", onda: 1 },
  "Wallyson dos Santos|Golden Cargo": { classe: "b", onda: 1 },
  "Mirtes Lopes|Golden Cargo": { classe: "d", onda: 0 },
  // Grupo Polar (ângulo diferente; cesta só se o Luigi mantiver)
  "Amir Musleh|Grupo Polar": { classe: "a", onda: 1 },
  "Pedro de Andrade|Grupo Polar": { classe: "b", onda: 1 },
  "Lucas Tavares|Grupo Polar": { classe: "c", onda: 1 },
  "Thiago Bessone|Grupo Polar": { classe: "c", onda: 1 },
  "Liana Montemor|Grupo Polar": { classe: "a", onda: 2 },
  "Samuel Lopes|Grupo Polar": { classe: "b", onda: 0, flag: "domínio floralatlanta.com.br (outra empresa)" },
  "José Braga|Grupo Polar": { classe: "b", onda: 0, flag: "domínio usjt.br (universidade)" },
  "Claudia Souza|Grupo Polar": { classe: "d", onda: 0 },
  "Leticia de Castro|Grupo Polar": { classe: "d", onda: 0 },
  "Angelica Morais|Grupo Polar": { classe: "d", onda: 0 },
  "Marcelo Belussi|Grupo Polar": { classe: "d", onda: 0 },
  // Grupo Prime
  "Rodrigo Nascimento|Grupo Prime": { classe: "b", onda: 1 },
  "Hellen Peres|Grupo Prime": { classe: "c", onda: 1 },
  "Andreia Rodrigues|Grupo Prime": { classe: "c", onda: 1 },
  "Paulo Ana|Grupo Prime": { classe: "b", onda: 1, flag: "domínio gritsch.com.br (outra transportadora?)" },
  "Edna Melo|Grupo Prime": { classe: "d", onda: 2 },
  // Grupo TAFF
  "Marcelo Paixão|Grupo TAFF": { classe: "a", onda: 1 },
  // HospLog (empresa sai)
  "Natasha De Jesus|HospLog": { classe: "b", onda: 0, flag: "domínio unimedcampinas.com.br" },
  // MXLOG
  "Vanessa Carolina|MXLOG": { classe: "b", onda: 1 },
  // Neolider (empresa sai)
  "Aldo Teixeira|Neolider Tubos e Conexões de Aço": { classe: "d", onda: 0 },
  "Cibele Toledo|Neolider Tubos e Conexões de Aço": { classe: "d", onda: 0 },
  "Daiana Nascimento|Neolider Tubos e Conexões de Aço": { classe: "d", onda: 0 },
  "Diogo Teixeira|Neolider Tubos e Conexões de Aço": { classe: "c", onda: 0 },
  "Roger Costa|Neolider Tubos e Conexões de Aço": { classe: "d", onda: 0 },
  "Sandro Munhoz|Neolider Tubos e Conexões de Aço": { classe: "b", onda: 0 },
  "Thiago Santos|Neolider Tubos e Conexões de Aço": { classe: "b", onda: 0 },
  // Pelog
  "César Pelucio|Pelog Soluções Logísticas": { classe: "a", onda: 1 },
  "Ewerthon M.|Pelog Soluções Logísticas": { classe: "b", onda: 1 },
  "Geraldo de Souza Filho|Pelog Soluções Logísticas": { classe: "b", onda: 1 },
  "Tiago Calegari|Pelog Soluções Logísticas": {
    classe: "c",
    onda: 2,
    flag: "domínio eaglesolutions.log.br; headline Head Comercial da Eagle Solutions (outra empresa)",
  },
  // PierServ
  "Cristina Machado|PierServ Logística Promocional": { classe: "a", onda: 1 },
  "Rodrigo Martins|PierServ Logística Promocional": { classe: "a", onda: 1 },
  "Daniel Silva|PierServ Logística Promocional": { classe: "b", onda: 1 },
  "Rafael da silva|PierServ Logística Promocional": { classe: "b", onda: 1 },
  "Daiane Carvalho|PierServ Logística Promocional": { classe: "a", onda: 2 },
  "Arnaldo Ferreira|PierServ Logística Promocional": { classe: "b", onda: 2 },
  "Rafael Simplicio|PierServ Logística Promocional": { classe: "b", onda: 2 },
  "Maria Fatima|PierServ Logística Promocional": { classe: "b", onda: 2 },
  "Monalisa Lima|PierServ Logística Promocional": { classe: "c", onda: 2 },
  "Clóvis Rizzi|PierServ Logística Promocional": { classe: "d", onda: 0 },
  // Piquetur
  "Henzo Galera|Piquetur Soluções Logísticas": { classe: "a", onda: 1 },
  "Fabio dos Santos Ramos|Piquetur Soluções Logísticas": { classe: "b", onda: 1 },
  // Rodomaxlog
  "Rita de Cássia Calderani Borine|Rodomaxlog Armazenagem e Logística Ltda": { classe: "a", onda: 1 },
  "Alex Geronimo|Rodomaxlog Armazenagem e Logística Ltda": {
    classe: "b",
    onda: 2,
    flag: "domínio gatlogistica.com.br; headline Gerente de Operações CD da GAT Logística (outra empresa)",
  },
  // Sensitive
  "Emanuel Santos|Sensitive Transportes": { classe: "b", onda: 1 },
  "Adriana Alves|Sensitive Transportes": { classe: "b", onda: 1 },
  "Beatriz Américo|Sensitive Transportes": { classe: "d", onda: 0 },
  // Smolka
  "Jefferson Ramos|Smolka Transportes": { classe: "b", onda: 1 },
  "Humberto Bezerra|Smolka Transportes": { classe: "b", onda: 1 },
  "Leandro Antunes|Smolka Transportes": {
    classe: "b",
    onda: 1,
    flag: "domínio qualitytransportes.com.br; headline Gerente de Frota da Quality (summary diz Smolka)",
  },
  "André Guimarães|Smolka Transportes": { classe: "d", onda: 2 },
  // Soluciona
  "Claudio dos Reis|Soluciona Logística": { classe: "b", onda: 1 },
  "Fabricio Nascimento|Soluciona Logística": { classe: "b", onda: 1 },
  "Renan Lima|Soluciona Logística": { classe: "b", onda: 1 },
  // Spare Partners
  "Arthur Quental|Spare Partners - MRO Solutions": { classe: "a", onda: 1 },
  "João Dimitrescu|Spare Partners - MRO Solutions": { classe: "a", onda: 1 },
  "Luiz Barreira|Spare Partners - MRO Solutions": { classe: "b", onda: 1 },
  "Fernando da Silva|Spare Partners - MRO Solutions": { classe: "b", onda: 1 },
  "Marcio de Oliveira|Spare Partners - MRO Solutions": { classe: "b", onda: 2 },
  "José Vieira|Spare Partners - MRO Solutions": { classe: "b", onda: 2 },
  "Thiago de lima|Spare Partners - MRO Solutions": { classe: "b", onda: 2 },
  "Gisleide Guelere|Spare Partners - MRO Solutions": { classe: "d", onda: 0 },
  // Terra Nova
  "Marina Lima|Terra Nova Logística": { classe: "a", onda: 1 },
  "Stéphanie Azevedo|Terra Nova Logística": { classe: "b", onda: 1 },
  "Cristiano de oliveira|Terra Nova Logística": { classe: "b", onda: 1 },
  "Talita Ventura|Terra Nova Logística": { classe: "c", onda: 1 },
  "Vagner De Almeida Ferreira|Terra Nova Logística": { classe: "a", onda: 2 },
  "Regina de Souza Silva|Terra Nova Logística": { classe: "b", onda: 2 },
  "Felipe Azevedo|Terra Nova Logística": { classe: "d", onda: 0 },
  "Vanessa Barros|Terra Nova Logística": { classe: "d", onda: 0 },
  // TQUIM
  "Bianca Tolendato|TQUIM Transportes Ltda.": { classe: "b", onda: 1 },
  "Luciene de Oliveira|TQUIM Transportes Ltda.": { classe: "d", onda: 0 },
  "Renata de Albuquerque Stanizi|TQUIM Transportes Ltda.": { classe: "d", onda: 0 },
  // Translima
  "Eduardo Marinho|Translima Logística": { classe: "b", onda: 1 },
  // Furlong
  "Marcelo Colletti|Transportes Furlong do Brasil": { classe: "b", onda: 1 },
  "Alessandro Sardela|Transportes Furlong do Brasil": { classe: "b", onda: 1 },
  "André Lamas|Transportes Furlong do Brasil": { classe: "b", onda: 1 },
  "Priscila Fogaça|Transportes Furlong do Brasil": { classe: "b", onda: 1 },
  // Verko
  "Régis Faria|Verko Logistics Planning": { classe: "a", onda: 1 },
  "Uilliam Santana|Verko Logistics Planning": { classe: "b", onda: 1 },
  "Micaela de Andrade|Verko Logistics Planning": { classe: "d", onda: 2 },
  // XPM
  "Gabriel Faganelo|XPM LOGÍSTICA": { classe: "b", onda: 1 },
  "Solana Teixeira|XPM LOGÍSTICA": { classe: "b", onda: 1 },
  "Larissa Hardt|XPM LOGÍSTICA": {
    classe: "b",
    onda: 0,
    flag: "domínio envistaco.com; headline Assistente de qualidade na Envista Brasil (outra empresa)",
  },
  // Zenatur (ângulo diferente; cesta só se o Luigi mantiver)
  "Sandro Carvalho|Zenatur ZT": { classe: "a", onda: 1 },
  "Edson Souza|Zenatur ZT": { classe: "b", onda: 1 },
  "Rafael de Souza|Zenatur ZT": { classe: "b", onda: 1 },
  "Vinicius Sousa|Zenatur ZT": { classe: "b", onda: 1 },
  "Robson Menezes|Zenatur ZT": { classe: "b", onda: 2 },
  "Marcos Alves|Zenatur ZT": { classe: "d", onda: 0 },
};

const IA_LIXO = new Set([
  "response",
  "unique aspects you generate about a person",
  "unique aspects you generate about a person:",
]);

async function main() {
  const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : undefined;
  const { openStore } = await import("../../src/lib/outbound/store");
  const store = openStore();
  const [contacts, imports] = await Promise.all([store.contacts(), store.imports()]);
  const lotes = imports.filter((b) => /logistica/i.test(b.origin) || /logistica/i.test(b.file));
  console.log("LOTES:");
  for (const b of lotes)
    console.log(
      ` - ${b.id.slice(0, 8)} | ${b.file.slice(-8)} | ${b.importedAt} | rows=${b.rows} imp=${b.imported} exc=${b.excluded} dup=${b.duplicates}`,
    );
  const ids = new Set(lotes.map((b) => b.id));
  const alvo = contacts.filter(
    (c) =>
      c.status === "active" && (ids.has(c.importBatchId) || (c.industria ?? "").toLowerCase().startsWith("logíst")),
  );
  console.log(`ATIVOS de logística: ${alvo.length}`);

  const key = (c: (typeof alvo)[number]) =>
    `${`${c.nome} ${c.sobrenome ?? ""}`.trim()}|${companyKey(c.empresa ?? "?")}`;
  const semDecisao = alvo.filter((c) => !D[key(c)]);
  if (semDecisao.length) {
    console.log(`\nATENÇÃO: ${semDecisao.length} contatos sem decisão codificada:`);
    for (const c of semDecisao) console.log(`  - ${key(c)} | ${c.cargo}`);
  }

  // --- 6) unificação por grafia
  const porEmpresa = new Map<string, typeof alvo>();
  for (const c of alvo) {
    const k = companyKey(c.empresa ?? "?");
    porEmpresa.set(k, [...(porEmpresa.get(k) ?? []), c]);
  }
  console.log(
    `\n=== 6) EMPRESAS: ${porEmpresa.size} unificadas (grafias distintas: ${new Set(alvo.map((c) => c.empresa)).size}) ===`,
  );
  for (const [k, arr] of porEmpresa) {
    const grafias = [...new Set(arr.map((c) => c.empresa))];
    if (grafias.length > 1) console.log(`- ${k}: ${grafias.map((g) => `"${g}"`).join(" + ")}`);
  }

  // --- 1) ICP de empresa
  console.log(`\n=== 1) ICP DE EMPRESA ===`);
  const icpCount = { fica: 0, sai: 0, angulo: 0 };
  for (const [k, arr] of [...porEmpresa].sort((a, b) => b[1].length - a[1].length)) {
    const dec = ICP_EMPRESA[k] ?? {
      icp: "fica" as Icp,
      motivo: "operação logística (transporte/armazém/forwarder/promocional)",
    };
    icpCount[dec.icp]++;
    if (dec.icp !== "fica" || ICP_EMPRESA[k])
      console.log(`- [${dec.icp.toUpperCase()}] ${k} (${arr.length}): ${dec.motivo}`);
  }
  console.log(`fica=${icpCount.fica} sai=${icpCount.sai} ângulo diferente=${icpCount.angulo}`);

  // --- 2) cargos
  console.log(`\n=== 2) CARGOS ===`);
  const classes: Record<Classe, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const c of alvo) classes[D[key(c)]?.classe ?? "b"]++;
  console.log(
    `a decisor=${classes.a} · b operacional=${classes.b} · c comercial/CS=${classes.c} · d fora=${classes.d}`,
  );
  console.log(`(d) fora da conversa, nominal:`);
  for (const c of alvo) {
    const d = D[key(c)];
    if (d?.classe === "d")
      console.log(`  - ${key(c).replace("|", " @ ")} | ${c.cargo} | ${d.onda === 0 ? "SAI" : "reserva"}`);
  }

  // --- 3) cesta
  console.log(`\n=== 3) CESTA ONDA 1 / RESERVA / SAI (por empresa) ===`);
  let onda1 = 0;
  let onda2 = 0;
  let sai = 0;
  let empresasOnda1 = 0;
  let semDecisor = 0;
  for (const [k, arr] of [...porEmpresa].sort((a, b) => b[1].length - a[1].length)) {
    const icp = ICP_EMPRESA[k]?.icp ?? "fica";
    const c1 = arr.filter((c) => D[key(c)]?.onda === 1);
    const c2 = arr.filter((c) => D[key(c)]?.onda === 2);
    const c0 = arr.filter((c) => (D[key(c)]?.onda ?? 0) === 0);
    const contaOnda1 = icp === "fica";
    if (contaOnda1) {
      onda1 += c1.length;
      onda2 += c2.length;
      sai += c0.length;
      if (c1.length) empresasOnda1++;
      if (c1.length && !c1.some((c) => D[key(c)].classe === "a")) semDecisor++;
    } else {
      sai += arr.length;
    }
    const tag = icp === "fica" ? "" : ` [${icp.toUpperCase()}: não entra na onda 1 de logística]`;
    console.log(`\n${k} (${arr.length})${tag}`);
    const fmt = (c: (typeof alvo)[number]) => {
      const d = D[key(c)];
      return `${`${c.nome} ${c.sobrenome ?? ""}`.trim()} — ${c.cargo} [${d.classe}]${d.flag ? ` ⚠ ${d.flag}` : ""}`;
    };
    if (c1.length) console.log(`  onda 1 (${c1.length}): ${c1.map(fmt).join(" · ")}`);
    if (c2.length) console.log(`  reserva (${c2.length}): ${c2.map(fmt).join(" · ")}`);
    if (c0.length) console.log(`  sai (${c0.length}): ${c0.map(fmt).join(" · ")}`);
  }
  console.log(
    `\nTOTAIS (só empresas FICA): onda 1 = ${onda1} contatos em ${empresasOnda1} empresas (${semDecisor} delas sem decisor na cesta) · reserva = ${onda2} · sai = ${sai} (inclui todos os contatos das empresas SAI/ÂNGULO)`,
  );

  // --- 4) material de personalização
  let sum200 = 0;
  let sumCurto = 0;
  let soHeadline = 0;
  let nada = 0;
  let iaLixo = 0;
  let iaCurto = 0;
  let iaOk = 0;
  const exemplosIa: string[] = [];
  for (const c of alvo) {
    const s = (c.custom.summary ?? "").trim();
    const h = (c.custom.headline ?? "").trim();
    if (s.length >= 200) sum200++;
    else if (s.length > 0) sumCurto++;
    else if (h && h !== "--") soHeadline++;
    else nada++;
    const ia = (c.custom["summarize linkedin profile"] ?? "").trim();
    if (IA_LIXO.has(ia.toLowerCase())) iaLixo++;
    else if (ia.endsWith("...") || ia.length <= 100) iaCurto++;
    else iaOk++;
    if (!IA_LIXO.has(ia.toLowerCase()) && exemplosIa.length < 5 && s.length === 0)
      exemplosIa.push(`${key(c).replace("|", " @ ")} (${ia.length} chars): ${JSON.stringify(ia)}`);
  }
  const iaLens = alvo.map((c) => (c.custom["summarize linkedin profile"] ?? "").trim().length);
  console.log(`\n=== 4) MATERIAL ===`);
  console.log(
    `summary >= 200 chars: ${sum200} · summary curto (1-199): ${sumCurto} · só headline: ${soHeadline} · nada: ${nada}`,
  );
  console.log(
    `resumo IA do Clay: completo ${iaOk} · truncado pelo export (termina em "..." / <=100 chars) ${iaCurto} · lixo (eco do prompt "Response"/"Unique aspects…") ${iaLixo} · tamanho máximo ${Math.max(...iaLens)} chars`,
  );
  console.log(`exemplos de resumo IA em contatos SEM summary (onde ele faria diferença):`);
  for (const e of exemplosIa) console.log(`  - ${e}`);

  // --- 5) domínios
  console.log(`\n=== 5) DOMÍNIOS: exceções ao domínio majoritário da empresa ===`);
  let excecoes = 0;
  for (const [k, arr] of porEmpresa) {
    const doms = new Map<string, number>();
    for (const c of arr) doms.set(emailDomain(c.email), (doms.get(emailDomain(c.email)) ?? 0) + 1);
    const slug = k
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, 5);
    // empate: prefere o domínio que carrega o nome da empresa (Rodomaxlog: rodomaxlog.com × gatlogistica)
    const [major] = [...doms].sort(
      (a, b) => b[1] - a[1] || Number(b[0].includes(slug)) - Number(a[0].includes(slug)),
    )[0];
    for (const c of arr) {
      const d = emailDomain(c.email);
      if (d !== major) {
        excecoes++;
        console.log(`- ${key(c).replace("|", " @ ")} | ${c.cargo} | dom=${d} (empresa: ${major}×${doms.get(major)})`);
      }
    }
    if (/rdstation|agencia|agência/i.test([...doms.keys()].join(" ")))
      console.log(`  !!! ${k}: domínio de agência/rdstation`);
  }
  console.log(
    `exceções: ${excecoes} · empresas com 1 contato só (sem base de comparação): ${[...porEmpresa.values()].filter((a) => a.length === 1).length}`,
  );
  const ver = new Map<string, number>();
  for (const c of alvo) ver.set(c.verification, (ver.get(c.verification) ?? 0) + 1);
  console.log(`verificação de entregabilidade: ${[...ver].map(([s, n]) => `${s}=${n}`).join(" ")}`);

  // --- dump para leitura (sem e-mail)
  if (out) {
    const rows = alvo
      .map((c) => ({
        empresa: companyKey(c.empresa ?? "?"),
        grafia: c.empresa,
        nome: `${c.nome} ${c.sobrenome ?? ""}`.trim(),
        cargo: c.cargo ?? "",
        dom: emailDomain(c.email),
        verif: c.verification,
        city: c.custom.city ?? "",
        headline: c.custom.headline ?? "",
        summaryLen: (c.custom.summary ?? "").trim().length,
        summary: (c.custom.summary ?? "").trim().slice(0, 600),
        ia: (c.custom["summarize linkedin profile"] ?? "").trim().slice(0, 900),
        decisao: D[key(c)] ?? null,
      }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.nome.localeCompare(b.nome));
    await fs.writeFile(out, JSON.stringify(rows, null, 1), "utf8");
    console.log(`\ndump gravado em ${out} (${rows.length} linhas, sem e-mail)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});

export {};
