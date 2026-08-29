/**
 * Dreamy Outbound — verificação de entregabilidade (PRD-EMAIL-OUTBOUND §11).
 * Lista fria com bounce > 3% queima o domínio em dias; por isso a política:
 * só contato `ok` recebe e-mail; `risky` fica segregado; `invalid` é excluído.
 *
 * Uso:
 *   pnpm outbound:verify --export unverified.csv   # exporta e-mails p/ o verificador externo
 *   pnpm outbound:verify --results resultado.csv   # importa o resultado (colunas email,status)
 *   pnpm outbound:verify --assume-ok --confirm     # override explícito: assume o risco sem verificar
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { normalizeText } from "../../src/lib/outbound/import-core";
import { parseCsv } from "../../src/lib/outbound/parse";
import { normalizeEmail, openStore, runExclusive } from "../../src/lib/outbound/store";
import type { Contact, VerificationStatus } from "../../src/lib/outbound/types";

const USAGE = `Uso: pnpm outbound:verify <modo>

  --export <arquivo.csv>   exporta os e-mails unverified (contatos ativos) para verificação
                           externa (MillionVerifier / ZeroBounce)
  --results <arquivo.csv>  importa o resultado do verificador (colunas: email,status) e
                           atualiza os contatos (ok | risky | invalid)
  --assume-ok --confirm    marca todos os unverified como ok SEM verificação externa
                           (o PRD §11 exige verificação; isto registra que o usuário
                           assumiu o risco)`;

/** Mapeia o vocabulário dos verificadores para o nosso VerificationStatus. */
function mapVerdict(raw: string): VerificationStatus | null {
  const value = normalizeText(raw).replace(/[\s-]+/g, "_");
  if (["ok", "valid", "deliverable", "good", "safe"].includes(value)) return "ok";
  if (["catch_all", "catchall", "unknown", "risky", "accept_all", "role"].includes(value)) return "risky";
  if (["invalid", "undeliverable", "bad", "do_not_mail", "disabled"].includes(value)) return "invalid";
  return null;
}

function printVerificationSummary(contacts: Contact[]): void {
  const active = contacts.filter((c) => c.status === "active");
  const count = (v: VerificationStatus) => active.filter((c) => c.verification === v).length;
  console.log("\nContatos ativos por verificação:");
  console.log(`  ok ........... ${count("ok")}  (elegíveis para envio)`);
  console.log(`  risky ........ ${count("risky")}  (catch-all/unknown — NÃO entram na campanha da V1)`);
  console.log(`  invalid ...... ${count("invalid")}`);
  console.log(`  unverified ... ${count("unverified")}  (rode --export → verificador → --results)`);
}

async function runExport(store: ReturnType<typeof openStore>, outFile: string): Promise<void> {
  const contacts = await store.contacts();
  const unverified = contacts.filter((c) => c.status === "active" && c.verification === "unverified");
  if (unverified.length === 0) {
    console.log("Nenhum contato ativo com verification=unverified — nada a exportar.");
    printVerificationSummary(contacts);
    return;
  }
  const csv = ["email", ...unverified.map((c) => c.email)].join("\n") + "\n";
  await fs.writeFile(outFile, csv, "utf8");
  console.log(`${unverified.length} e-mails exportados para ${outFile}.`);
  console.log("Envie o arquivo ao verificador externo (MillionVerifier/ZeroBounce) e");
  console.log("importe o resultado com: pnpm outbound:verify --results <resultado.csv>");
  logger.info("outbound.verify.export", { exported: unverified.length, file: path.basename(outFile) });
}

async function runResults(store: ReturnType<typeof openStore>, resultsFile: string): Promise<void> {
  const table = parseCsv(await fs.readFile(resultsFile));
  const normalizedHeaders = table.headers.map((h) => normalizeText(h));
  const emailCol = normalizedHeaders.findIndex((h) => h === "email" || h === "e-mail" || h.includes("email"));
  const statusCol = normalizedHeaders.findIndex(
    (h) => h === "status" || h === "result" || h === "resultado" || h.includes("status"),
  );
  if (emailCol < 0 || statusCol < 0) {
    throw new Error(
      `arquivo de resultados precisa das colunas "email" e "status" (cabeçalhos encontrados: ${table.headers.join(", ")}).`,
    );
  }

  const contacts = await store.contacts();
  const byEmail = new Map(contacts.map((c) => [normalizeEmail(c.email), c]));
  const counts: Record<VerificationStatus, number> = { ok: 0, risky: 0, invalid: 0, unverified: 0 };
  let notFound = 0;
  let unrecognized = 0;

  for (const row of table.rows) {
    const email = normalizeEmail(row[emailCol] ?? "");
    if (email === "") continue;
    const verdict = mapVerdict(row[statusCol] ?? "");
    if (verdict === null) {
      unrecognized++;
      continue;
    }
    const contact = byEmail.get(email);
    if (!contact) {
      notFound++;
      continue;
    }
    contact.verification = verdict;
    if (verdict === "invalid" && contact.status === "active") {
      // política do PRD §11: invalid → excluded (nunca descartado silenciosamente)
      contact.status = "excluded";
      contact.excludedReason = "verificacao-invalid";
    }
    counts[verdict]++;
  }

  await store.saveContacts(contacts);
  console.log(`Resultados de ${path.basename(resultsFile)} aplicados:`);
  console.log(`  ok ............... ${counts.ok}`);
  console.log(`  risky ............ ${counts.risky}  (segregados — não entram na campanha da V1)`);
  console.log(`  invalid .......... ${counts.invalid}  (marcados como excluded)`);
  console.log(`  não encontrados .. ${notFound}`);
  console.log(`  status ignorado .. ${unrecognized}  (valor não reconhecido no CSV)`);
  printVerificationSummary(contacts);
  logger.info("outbound.verify.results", {
    file: path.basename(resultsFile),
    ok: counts.ok,
    risky: counts.risky,
    invalid: counts.invalid,
    notFound,
    unrecognized,
  });
}

async function runAssumeOk(store: ReturnType<typeof openStore>, confirmed: boolean): Promise<void> {
  if (!confirmed) {
    console.error("--assume-ok exige --confirm: o PRD §11 exige verificação externa antes do 1º envio.");
    console.error("Este modo marca tudo como ok por sua conta e risco (bounce alto pode queimar o domínio).");
    process.exitCode = 1;
    return;
  }
  const contacts = await store.contacts();
  let updated = 0;
  for (const contact of contacts) {
    if (contact.status === "active" && contact.verification === "unverified") {
      contact.verification = "ok";
      updated++;
    }
  }
  await store.saveContacts(contacts);
  console.log(`AVISO: ${updated} contatos unverified marcados como ok SEM verificação externa.`);
  console.log("Registro: o usuário assumiu o risco de bounce (override do requisito do PRD §11).");
  printVerificationSummary(contacts);
  logger.warn("outbound.verify.assume_ok", { updated, assumedRiskByUser: true });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      export: { type: "string" },
      results: { type: "string" },
      "assume-ok": { type: "boolean", default: false },
      confirm: { type: "boolean", default: false },
    },
  });

  const modes = [values.export !== undefined, values.results !== undefined, values["assume-ok"] === true];
  if (modes.filter(Boolean).length !== 1) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const store = openStore();
  if (values.export !== undefined) await runExport(store, values.export);
  else if (values.results !== undefined) await runResults(store, values.results);
  else await runAssumeOk(store, values.confirm === true);
}

runExclusive("verify", main).catch((err: unknown) => {
  console.error(`\nErro na verificação: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
