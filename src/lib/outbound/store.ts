import fs from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../observability/logger";
import { createNeonSqlClient, type SqlClient } from "./sql";
import { DEFAULT_STATE, LOCK_STALE_MS, LOCK_WAIT_MS, normalizeEmail } from "./store-common";
import { acquireDbLock, createPgStore, releaseDbLock } from "./store-pg";
import type {
  AgentActivity,
  AiBriefing,
  CampaignRuntime,
  Company,
  Contact,
  CrmNote,
  CrmTask,
  Deal,
  Demand,
  Enrollment,
  ImportBatch,
  OutboundEvent,
  OutboundState,
  Reply,
  SendRecord,
  Suppression,
  WorkspaceSettings,
} from "./types";

export { DEFAULT_STATE, normalizeEmail };

/**
 * Store do outbound. Duas implementações com a MESMA semântica (coleções lidas e
 * gravadas inteiras):
 * - arquivos JSON em `.outbound/` (ADR-019) — dev, demo e operação sem banco;
 * - Postgres (ADR-023) quando `OUTBOUND_DATABASE_URL` existe — plataforma
 *   hospedada: o console na Vercel e os CLIs na máquina do operador compartilham
 *   o mesmo banco.
 * `openStore()` sem argumento escolhe pela env; `openStore(dir)` força arquivos
 * (demo, backups, testes).
 */

const COLLECTIONS = {
  contacts: "contacts.json",
  companies: "companies.json",
  campaigns: "campaigns.json",
  enrollments: "enrollments.json",
  sends: "sends.json",
  suppressions: "suppressions.json",
  replies: "replies.json",
  imports: "imports.json",
  deals: "deals.json",
  notes: "notes.json",
  tasks: "tasks.json",
  demands: "demands.json",
  agentActivities: "agent-activities.json",
  briefings: "briefings.json",
  settings: "settings.json",
} as const;

type CollectionName = keyof typeof COLLECTIONS;

const EVENTS_FILE = "events.jsonl";
const STATE_FILE = "config.json";

export function outboundDir(): string {
  return process.env.OUTBOUND_STORE_DIR?.trim() || path.join(process.cwd(), ".outbound");
}

export function databaseUrl(): string | null {
  return process.env.OUTBOUND_DATABASE_URL?.trim() || null;
}

export function newId(): string {
  return randomUUID();
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

export interface OutboundStore {
  /** Diretório LOCAL (snapshots de plano, relatórios). No Postgres continua sendo local. */
  readonly dir: string;

  contacts(): Promise<Contact[]>;
  saveContacts(rows: Contact[]): Promise<void>;
  contactByEmail(email: string): Promise<Contact | undefined>;

  companies(): Promise<Company[]>;
  saveCompanies(rows: Company[]): Promise<void>;

  campaignRuntimes(): Promise<CampaignRuntime[]>;
  saveCampaignRuntimes(rows: CampaignRuntime[]): Promise<void>;

  enrollments(): Promise<Enrollment[]>;
  saveEnrollments(rows: Enrollment[]): Promise<void>;

  sends(): Promise<SendRecord[]>;
  saveSends(rows: SendRecord[]): Promise<void>;

  suppressions(): Promise<Suppression[]>;
  isSuppressed(email: string): Promise<boolean>;
  /** Idempotente: suprimir e-mail já suprimido não duplica. Retorna true se adicionou. */
  suppress(entry: Omit<Suppression, "createdAt">): Promise<boolean>;

  replies(): Promise<Reply[]>;
  saveReplies(rows: Reply[]): Promise<void>;

  imports(): Promise<ImportBatch[]>;
  saveImports(rows: ImportBatch[]): Promise<void>;

  /* CRM piloto (aditivo; o motor de envio nunca lê estas coleções) */
  deals(): Promise<Deal[]>;
  saveDeals(rows: Deal[]): Promise<void>;
  notes(): Promise<CrmNote[]>;
  saveNotes(rows: CrmNote[]): Promise<void>;
  tasks(): Promise<CrmTask[]>;
  saveTasks(rows: CrmTask[]): Promise<void>;
  demands(): Promise<Demand[]>;
  saveDemands(rows: Demand[]): Promise<void>;
  agentActivities(): Promise<AgentActivity[]>;
  saveAgentActivities(rows: AgentActivity[]): Promise<void>;
  briefings(): Promise<AiBriefing[]>;
  saveBriefings(rows: AiBriefing[]): Promise<void>;
  /** Singleton: lista com 0 ou 1 documento (id "workspace"). */
  workspaceSettings(): Promise<WorkspaceSettings[]>;
  saveWorkspaceSettings(rows: WorkspaceSettings[]): Promise<void>;

  events(): Promise<OutboundEvent[]>;
  /** Append-only com dedupe por sourceKey. Retorna true se registrou. */
  appendEvent(event: Omit<OutboundEvent, "id" | "recordedAt">): Promise<boolean>;

  state(): Promise<OutboundState>;
  saveState(state: OutboundState): Promise<void>;
}

/** Store em arquivos JSON (sempre local). */
export function openFileStore(dir = outboundDir()): OutboundStore {
  const file = (name: string) => path.join(dir, name);
  const collection = <T>(name: CollectionName) => readJson<T[]>(file(COLLECTIONS[name]), []);
  const saveCollection = (name: CollectionName, rows: unknown[]) => writeJsonAtomic(file(COLLECTIONS[name]), rows);

  let eventKeys: Set<string> | null = null;

  async function readEvents(): Promise<OutboundEvent[]> {
    try {
      const raw = await fs.readFile(file(EVENTS_FILE), "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as OutboundEvent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  return {
    dir,

    contacts: () => collection<Contact>("contacts"),
    saveContacts: (rows) => saveCollection("contacts", rows),
    async contactByEmail(email) {
      const normalized = normalizeEmail(email);
      const rows = await collection<Contact>("contacts");
      return rows.find((c) => c.email === normalized);
    },

    companies: () => collection<Company>("companies"),
    saveCompanies: (rows) => saveCollection("companies", rows),

    campaignRuntimes: () => collection<CampaignRuntime>("campaigns"),
    saveCampaignRuntimes: (rows) => saveCollection("campaigns", rows),

    enrollments: () => collection<Enrollment>("enrollments"),
    saveEnrollments: (rows) => saveCollection("enrollments", rows),

    sends: () => collection<SendRecord>("sends"),
    saveSends: (rows) => saveCollection("sends", rows),

    suppressions: () => collection<Suppression>("suppressions"),
    async isSuppressed(email) {
      const rows = await collection<Suppression>("suppressions");
      const normalized = normalizeEmail(email);
      return rows.some((s) => s.email === normalized);
    },
    async suppress(entry) {
      const rows = await collection<Suppression>("suppressions");
      const email = normalizeEmail(entry.email);
      if (rows.some((s) => s.email === email)) return false;
      rows.push({ ...entry, email, createdAt: new Date().toISOString() });
      await saveCollection("suppressions", rows);
      return true;
    },

    replies: () => collection<Reply>("replies"),
    saveReplies: (rows) => saveCollection("replies", rows),

    imports: () => collection<ImportBatch>("imports"),
    saveImports: (rows) => saveCollection("imports", rows),

    deals: () => collection<Deal>("deals"),
    saveDeals: (rows) => saveCollection("deals", rows),
    notes: () => collection<CrmNote>("notes"),
    saveNotes: (rows) => saveCollection("notes", rows),
    tasks: () => collection<CrmTask>("tasks"),
    saveTasks: (rows) => saveCollection("tasks", rows),
    demands: () => collection<Demand>("demands"),
    saveDemands: (rows) => saveCollection("demands", rows),
    agentActivities: () => collection<AgentActivity>("agentActivities"),
    saveAgentActivities: (rows) => saveCollection("agentActivities", rows),
    briefings: () => collection<AiBriefing>("briefings"),
    saveBriefings: (rows) => saveCollection("briefings", rows),
    workspaceSettings: () => collection<WorkspaceSettings>("settings"),
    saveWorkspaceSettings: (rows) => saveCollection("settings", rows),

    events: readEvents,
    async appendEvent(event) {
      if (eventKeys === null) {
        eventKeys = new Set((await readEvents()).map((e) => e.sourceKey));
      }
      if (eventKeys.has(event.sourceKey)) return false;
      eventKeys.add(event.sourceKey);
      const full: OutboundEvent = { ...event, id: newId(), recordedAt: new Date().toISOString() };
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(file(EVENTS_FILE), JSON.stringify(full) + "\n", "utf8");
      return true;
    },

    state: () => readJson<OutboundState>(file(STATE_FILE), DEFAULT_STATE),
    saveState: (state) => writeJsonAtomic(file(STATE_FILE), state),
  };
}

let sharedSqlClient: SqlClient | null = null;
let sharedSqlUrl: string | null = null;

/** Cliente SQL compartilhado do processo (Neon via HTTP — sem pool para gerenciar). */
export function getSqlClient(): SqlClient {
  const url = databaseUrl();
  if (!url) throw new Error("OUTBOUND_DATABASE_URL não definida.");
  if (!sharedSqlClient || sharedSqlUrl !== url) {
    sharedSqlClient = createNeonSqlClient(url);
    sharedSqlUrl = url;
  }
  return sharedSqlClient;
}

/**
 * Store padrão: `dir` explícito força arquivos (demo, backup); sem `dir`, usa o
 * Postgres se `OUTBOUND_DATABASE_URL` existir, senão arquivos em `.outbound/`.
 */
export function openStore(dir?: string): OutboundStore {
  if (dir) return openFileStore(dir);
  if (databaseUrl()) return createPgStore(getSqlClient(), outboundDir());
  return openFileStore(outboundDir());
}

/**
 * Lock de processo para os CLIs e actions mutantes: o store faz read-modify-write
 * de coleções inteiras, então dois comandos simultâneos perderiam atualizações.
 * Arquivos: lockfile em `.outbound/.lock`. Postgres: linha em `outbound_locks`
 * com TTL — mesma semântica (lock órfão > 10 min é roubado).
 */
export async function runExclusive<T>(label: string, fn: () => Promise<T>, dirOverride?: string): Promise<T> {
  try {
    process.loadEnvFile(".env.local"); // OUTBOUND_STORE_DIR/OUTBOUND_DATABASE_URL podem vir do .env.local
  } catch {
    // sem .env.local — vale a env do shell
  }
  if (!dirOverride && databaseUrl()) return runExclusiveDb(label, fn);
  return runExclusiveFile(label, fn, dirOverride ?? outboundDir());
}

/** Backoff do retry de release: o Neon via HTTP tem falha transitória com alguma frequência. */
const LOCK_RELEASE_RETRY_DELAYS_MS: readonly number[] = [250, 500, 1000];

/**
 * Release confiável do lock distribuído. Uma falha transitória de rede aqui era
 * engolida em silêncio e deixava o lock órfão por LOCK_STALE_MS (10 min),
 * bloqueando todo comando seguinte. Tenta de novo com backoff curto; se ainda
 * falhar, registra aviso e NUNCA lança: o resultado da operação protegida não
 * pode ser perdido por falha de release (estamos num finally).
 */
export async function releaseDbLockReliably(
  client: SqlClient,
  name: string,
  holder: string,
  delaysMs: readonly number[] = LOCK_RELEASE_RETRY_DELAYS_MS,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await releaseDbLock(client, name, holder);
      return;
    } catch (err) {
      const delay = delaysMs[attempt];
      if (delay === undefined) {
        logger.warn("outbound.lock.release_falhou", {
          lock: name,
          holder,
          tentativas: attempt + 1,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // sinal 0 = só checa existência (funciona em Windows e POSIX)
    return true;
  } catch (err) {
    // EPERM: o processo existe mas não temos permissão — tratamos como vivo.
    // Qualquer outro erro (ESRCH): não há processo com esse pid.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Segunda linha de defesa contra lock órfão: se o holder atual é
 * "<host>:<pid>:<sufixo>" desta MESMA máquina e o pid não existe mais (o caso
 * clássico é CLI que morreu ou saiu por process.exit(), que pula o finally),
 * remove a linha. O DELETE é condicionado ao holder lido — se outro processo
 * pegou o lock nesse meio-tempo, vira no-op. Reuso de pid só causa falso
 * "vivo" (seguro: espera o TTL, como hoje); falso "morto" exigiria outra
 * máquina com o mesmo hostname, por isso a defesa fica DESLIGADA em serverless
 * (VERCEL), onde hostname/pid não identificam um processo observável.
 */
export async function stealDeadLocalDbLock(
  client: SqlClient,
  name: string,
  opts: { isAlive?: (pid: number) => boolean } = {},
): Promise<boolean> {
  if (process.env.VERCEL) return false;
  const rows = await client.query<{ holder: string }>("SELECT holder FROM outbound_locks WHERE name = $1", [name]);
  const current = rows[0]?.holder;
  if (!current) return false;
  const [host, pidRaw] = current.split(":");
  const pid = Number(pidRaw);
  if (host !== hostname() || !Number.isInteger(pid) || pid <= 0) return false;
  if ((opts.isAlive ?? isPidAlive)(pid)) return false;
  await client.query("DELETE FROM outbound_locks WHERE name = $1 AND holder = $2", [name, current]);
  logger.warn("outbound.lock.orfao_removido", { lock: name, holder: current });
  return true;
}

async function runExclusiveDb<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const client = getSqlClient();
  const holder = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const started = Date.now();
  while (!(await acquireDbLock(client, "outbound", holder, LOCK_STALE_MS))) {
    if (Date.now() - started > LOCK_WAIT_MS) {
      throw new Error(
        `outro comando outbound está rodando (${label}: lock "outbound" ocupado no banco) — aguarde terminar`,
      );
    }
    // Lock órfão de processo morto desta máquina? Remove e tenta de novo já.
    if (await stealDeadLocalDbLock(client, "outbound").catch(() => false)) continue;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  try {
    return await fn();
  } finally {
    await releaseDbLockReliably(client, "outbound", holder);
  }
}

async function runExclusiveFile<T>(label: string, fn: () => Promise<T>, dir: string): Promise<T> {
  const lockPath = path.join(dir, ".lock");
  await fs.mkdir(dir, { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, label, at: new Date().toISOString() }) + "\n", "utf8");
      await handle.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        continue; // lock sumiu entre o open e o stat — tente de novo
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(
          `outro comando outbound está rodando (lock em ${lockPath}) — aguarde terminar; se tiver certeza de que não há outro processo, apague o arquivo de lock`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // CLIs usam process.exit() em caminhos de erro — isso pula o finally, então a
  // limpeza do lock também fica registrada no evento "exit" (síncrono).
  const releaseOnExit = () => {
    try {
      unlinkSync(lockPath);
    } catch {
      // já liberado
    }
  };
  process.once("exit", releaseOnExit);
  try {
    return await fn();
  } finally {
    process.removeListener("exit", releaseOnExit);
    await fs.unlink(lockPath).catch(() => {});
  }
}
