// One-off (2026-10-13): auditoria GARIMPO + cesta do lote de CONTROLADORIA (Clay run
// 2026-10, "Controllers, Mid-sized Companies, São Paulo"). O filtro do Clay casou a
// palavra "controlador" em cargos operacionais (estoque, acesso, produção, frota...),
// então a cesta é por cargo. Regras, por contato do lote:
//   industria                   → "controladoria" (export veio sem coluna)
//   cargo operacional           → excluded, excludedReason "fora-icp-controladoria"
//   domínio do e-mail sem relação com o nome da empresa → excluded,
//                                 "dominio-divergente-controladoria" (reserva até conferência)
//   acima do cap de 2 por empresa (prioridade: tem Sobre, depois senioridade)
//                               → excluded, "cap-empresa-controladoria"
//   sem Sobre no LinkedIn       → excluded, "aguardando-onda-2-controladoria"
//                                 (onda 1 = personalização a partir do Sobre)
//   o resto                     → active, custom.cesta = "controladoria onda-1"
// Sem PII no stdout (só domínios e nomes de empresa). Idempotente.
// Uso: pnpm tsx scripts/dev/apply-cesta-controladoria.ts [--apply]

import type { Contact } from "../../src/lib/outbound/types";

const LOTE = "b730e012-bf8c-4d2f-999e-9062b5c4ca33";
const CAP_POR_EMPRESA = 2;

const OPERACIONAL =
  /estoque|acesso|produ[cç]|manuten|frota|almoxar|qualidade|tr[aá]fego|project cost|cost controller|document|obra|jornada|portaria|seguran|expedi|log[ií]stic|operational|planejamento e controle|\bpcp\b|cobran|risco|tesour|entrada e sa|abastec|servi[cç]os|processo|materia|pesagem|rodovi|cadeia de suprimentos|conferente|invent[aá]rio|ped[aá]gio|[aá]rea comercial|transporte|sistema/i;
const CONTROLADORIA =
  /controller|controladoria|controladora|controlling|fp&a|contab|cont[aá]bil|financ|\bcfo\b|accounting|or[cç]ament|custos|budget|planejamento financeiro/i;

const STOP = new Set([
  "grupo",
  "group",
  "ltda",
  "ltd",
  "sa",
  "s/a",
  "brasil",
  "brazil",
  "do",
  "da",
  "de",
  "e",
  "the",
  "cia",
  "company",
  "inc",
  "holding",
  "indústria",
  "industria",
  "comércio",
  "comercio",
  "empresa",
]);

function tokens(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/**
 * Pares conferidos à mão em 2026-10-13 (sigla da empresa ou grupo controlador): a
 * heurística abaixo os marcaria como divergentes. Tudo que NÃO está aqui e diverge
 * vai para a reserva até o Luigi confirmar (dado velho do Clay: BYD ↔ ab-inbev etc.).
 */
const DOMINIO_CONFIRMADO = new Set([
  "awnet.com.br", // Athié Wohnrath (AW)
  "grupobt.com.br", // Grupo BT
  "grupoht.com.br", // GHT - Grupo Hidrau Torque
  "mkcorp.com", // Mary Kay
  "trescon.com.br", // 3CON
  "br.havasvillage.com", // BETC Havas
  "beiersdorf.com", // BDF Nivea (Beiersdorf)
  "tenaris.com", // Confab Industrial (Tenaris)
  "airbus.com", // Helibras (Airbus)
  "ecovias.com.br", // Ecopistas (grupo Ecovias)
  "brssz.com", // Autoridade Portuária de Santos
  "br.nestle.com", // Puravida (Nestlé)
]);

/** Domínio do e-mail tem relação com o nome da empresa? (heurística conservadora) */
function dominioCombina(empresa: string, dominio: string): boolean {
  if (DOMINIO_CONFIRMADO.has(dominio)) return true;
  const label = dominio.split(".")[0] ?? "";
  const labelLimpo = label.replace(/[^a-z0-9]/g, "");
  const ts = tokens(empresa);
  if (ts.length === 0) return true;
  if (ts.some((t) => labelLimpo.includes(t) || t.includes(labelLimpo))) return true;
  const sigla = ts.map((t) => t[0]).join("");
  if (sigla.length >= 3 && labelLimpo.includes(sigla)) return true;
  const colado = ts.join("");
  return colado.includes(labelLimpo) && labelLimpo.length >= 4;
}

function classeCargo(cargo: string): "controladoria" | "operacional" {
  const c = cargo.toLowerCase();
  if (CONTROLADORIA.test(c) && !/controlador de/i.test(c)) return "controladoria";
  if (OPERACIONAL.test(c)) return "operacional";
  return CONTROLADORIA.test(c) ? "controladoria" : "operacional";
}

function senioridade(cargo: string): number {
  const c = cargo.toLowerCase();
  if (/diretor|director|\bcfo\b|head|vp\b|vice/.test(c)) return 3;
  if (/gerente|manager|s[eê]nior|senior|\bsr\b/.test(c)) return 2;
  if (/coorden|coordinator|supervis|pleno/.test(c)) return 1;
  return 0;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const apply = process.argv.includes("--apply");
  const { openStore, runExclusive } = await import("../../src/lib/outbound/store");

  await runExclusive("apply-cesta-controladoria", async () => {
    const store = openStore();
    const contacts = await store.contacts();
    const lote = contacts.filter((c) => c.importBatchId === LOTE);
    if (lote.length === 0) throw new Error("lote não encontrado no store");

    const decisao = new Map<string, { status: Contact["status"]; reason?: string; cesta?: string }>();
    const contagem = new Map<string, number>();
    const bump = (k: string) => contagem.set(k, (contagem.get(k) ?? 0) + 1);
    const divergentes: string[] = [];

    // 1) cargo e domínio
    const candidatos: Contact[] = [];
    for (const c of lote) {
      const dominio = (c.email.split("@")[1] ?? "").toLowerCase();
      if (classeCargo(c.cargo ?? "") === "operacional") {
        decisao.set(c.id, { status: "excluded", reason: "fora-icp-controladoria" });
        bump("fora (cargo operacional)");
        continue;
      }
      if (!dominioCombina(c.empresa ?? "", dominio)) {
        decisao.set(c.id, { status: "excluded", reason: "dominio-divergente-controladoria" });
        divergentes.push(`${c.empresa} ↔ ${dominio}`);
        bump("reserva (domínio divergente)");
        continue;
      }
      candidatos.push(c);
    }

    // 2) cap por empresa: quem tem Sobre primeiro, depois senioridade
    const porEmpresa = new Map<string, Contact[]>();
    for (const c of candidatos) {
      const k = tokens(c.empresa ?? "").join(" ") || (c.empresa ?? "").toLowerCase();
      porEmpresa.set(k, [...(porEmpresa.get(k) ?? []), c]);
    }
    const temSobre = (c: Contact) => String(c.custom?.summary ?? "").trim().length > 0;
    for (const grupo of porEmpresa.values()) {
      grupo.sort(
        (a, b) => Number(temSobre(b)) - Number(temSobre(a)) || senioridade(b.cargo ?? "") - senioridade(a.cargo ?? ""),
      );
      grupo.forEach((c, i) => {
        if (i >= CAP_POR_EMPRESA) {
          decisao.set(c.id, { status: "excluded", reason: "cap-empresa-controladoria" });
          bump("reserva (cap por empresa)");
        } else if (!temSobre(c)) {
          decisao.set(c.id, { status: "excluded", reason: "aguardando-onda-2-controladoria" });
          bump("onda 2 (sem Sobre)");
        } else {
          decisao.set(c.id, { status: "active", cesta: "controladoria onda-1" });
          bump("onda 1");
        }
      });
    }

    const empresasOnda1 = new Set(
      lote.filter((c) => decisao.get(c.id)?.status === "active").map((c) => tokens(c.empresa ?? "").join(" ")),
    );
    const colegas = [...porEmpresa.values()].filter(
      (g) => g.filter((c) => decisao.get(c.id)?.status === "active").length >= 2,
    ).length;

    console.log(`lote ${LOTE.slice(0, 8)}: ${lote.length} contatos`);
    for (const [k, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);
    console.log(
      `  onda 1: ${empresasOnda1.size} empresas · ${colegas} com 2 colegas (frase_colegas) · solos ${empresasOnda1.size - colegas}`,
    );
    console.log(`\ndomínios divergentes (${divergentes.length}) para conferência humana:`);
    for (const d of divergentes.sort()) console.log(`  ${d}`);

    if (!apply) {
      console.log("\nDRY-RUN: nada gravado. Repita com --apply.");
      return;
    }
    let mudados = 0;
    for (const c of lote) {
      const d = decisao.get(c.id);
      if (!d) continue;
      c.industria = "controladoria";
      c.status = d.status;
      if (d.status === "excluded") c.excludedReason = d.reason;
      else delete c.excludedReason;
      c.custom.cesta = d.cesta ?? `controladoria ${d.reason}`;
      mudados += 1;
    }
    await store.saveContacts(contacts);
    console.log(`\n✓ ${mudados} contatos atualizados (industria, status, cesta).`);
  });
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

export {};
