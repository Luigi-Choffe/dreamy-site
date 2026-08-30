/**
 * `pnpm outbound:db <migrate|push|pull|status>` — banco Postgres da plataforma (ADR-023).
 *
 *   migrate            cria/atualiza as tabelas (idempotente)
 *   push [--confirm]   copia o store LOCAL (.outbound/) para o banco — uma vez, na migração
 *   pull [--dir <d>]   backup do banco para JSON local (default .outbound-backup-<data>/)
 *   status             contagens por coleção no banco
 *
 * Exige OUTBOUND_DATABASE_URL (connection string pooled do Neon) no .env.local.
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { logger } from "../../src/lib/observability/logger";
import { ensureSchema } from "../../src/lib/outbound/sql";
import { createPgStore } from "../../src/lib/outbound/store-pg";
import { databaseUrl, getSqlClient, openFileStore, outboundDir } from "../../src/lib/outbound/store";
import type { OutboundStore } from "../../src/lib/outbound/store";

async function copyStore(from: OutboundStore, to: OutboundStore): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const contacts = await from.contacts();
  await to.saveContacts(contacts);
  counts.contacts = contacts.length;
  const companies = await from.companies();
  await to.saveCompanies(companies);
  counts.companies = companies.length;
  const runtimes = await from.campaignRuntimes();
  await to.saveCampaignRuntimes(runtimes);
  counts.campaigns = runtimes.length;
  const enrollments = await from.enrollments();
  await to.saveEnrollments(enrollments);
  counts.enrollments = enrollments.length;
  const sends = await from.sends();
  await to.saveSends(sends);
  counts.sends = sends.length;
  const replies = await from.replies();
  await to.saveReplies(replies);
  counts.replies = replies.length;
  const imports = await from.imports();
  await to.saveImports(imports);
  counts.imports = imports.length;
  let suppressed = 0;
  for (const s of await from.suppressions()) {
    if (await to.suppress({ email: s.email, reason: s.reason, origin: s.origin })) suppressed += 1;
  }
  counts.suppressions = suppressed;
  let events = 0;
  for (const e of await from.events()) {
    if (
      await to.appendEvent({
        sendId: e.sendId,
        campaignSlug: e.campaignSlug,
        type: e.type,
        sourceKey: e.sourceKey,
        occurredAt: e.occurredAt,
      })
    ) {
      events += 1;
    }
  }
  counts.events = events;
  await to.saveState(await from.state());
  return counts;
}

function printCounts(title: string, counts: Record<string, number>): void {
  console.log(title);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sem .env.local — vale a env do shell
  }
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      confirm: { type: "boolean", default: false },
      dir: { type: "string" },
    },
  });
  const cmd = positionals[0] ?? "status";
  if (!databaseUrl()) {
    console.error("✖ OUTBOUND_DATABASE_URL ausente — pegue a connection string POOLED no Neon (Vercel → Storage).");
    process.exitCode = 1;
    return;
  }
  const client = getSqlClient();
  const pg = createPgStore(client, outboundDir());

  if (cmd === "migrate") {
    await ensureSchema(client);
    console.log("✓ Tabelas criadas/confirmadas (outbound_documents, outbound_events, outbound_state, outbound_locks).");
    logger.info("outbound.db.migrate", {});
    return;
  }

  if (cmd === "status") {
    const counts = {
      contacts: (await pg.contacts()).length,
      companies: (await pg.companies()).length,
      campaigns: (await pg.campaignRuntimes()).length,
      enrollments: (await pg.enrollments()).length,
      sends: (await pg.sends()).length,
      suppressions: (await pg.suppressions()).length,
      replies: (await pg.replies()).length,
      imports: (await pg.imports()).length,
      events: (await pg.events()).length,
    };
    printCounts("Banco (Postgres):", counts);
    console.log(`  armada: ${(await pg.state()).armed ? "SIM" : "não"}`);
    return;
  }

  if (cmd === "push") {
    const local = openFileStore(outboundDir());
    const existing = (await pg.contacts()).length + (await pg.sends()).length;
    if (existing > 0 && !values.confirm) {
      console.error(
        `✖ O banco já tem dados (${existing} registros). push SUBSTITUI as coleções pelo store local — repita com --confirm se for isso mesmo.`,
      );
      process.exitCode = 1;
      return;
    }
    await ensureSchema(client);
    const counts = await copyStore(local, pg);
    printCounts(`✓ Store local (${outboundDir()}) copiado para o banco:`, counts);
    console.log("Daqui em diante, com OUTBOUND_DATABASE_URL no .env.local, os CLIs usam o banco.");
    logger.info("outbound.db.push", counts);
    return;
  }

  if (cmd === "pull") {
    const dir = values.dir ?? path.join(process.cwd(), `.outbound-backup-${new Date().toISOString().slice(0, 10)}`);
    const counts = await copyStore(pg, openFileStore(dir));
    printCounts(`✓ Backup do banco em ${dir}:`, counts);
    logger.info("outbound.db.pull", counts);
    return;
  }

  console.error(`Subcomando desconhecido: "${cmd}". Use: migrate | push | pull | status.`);
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`\nErro: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
