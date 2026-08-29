import fs from "node:fs/promises";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CampaignRuntime,
  Company,
  Contact,
  Enrollment,
  ImportBatch,
  OutboundEvent,
  OutboundState,
  Reply,
  SendRecord,
  Suppression,
} from "./types";

/**
 * Store do outbound em arquivos JSON (`.outbound/`, gitignored) — ADR-019.
 * V1 local: volumes pequenos (rampa de 15–80 envios/dia), um único operador (CLI +
 * dashboard local). Escrita atômica via arquivo temporário + rename. A migração para
 * Postgres (fase de produção do PRD §22) troca esta implementação sem mudar chamadores.
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
} as const;

type CollectionName = keyof typeof COLLECTIONS;

const EVENTS_FILE = "events.jsonl";
const STATE_FILE = "config.json";

export const DEFAULT_STATE: OutboundState = { armed: false };

export function outboundDir(): string {
  return process.env.OUTBOUND_STORE_DIR ?? path.join(process.cwd(), ".outbound");
}

/** Lock considerado obsoleto (processo morto) depois deste prazo. */
const LOCK_STALE_MS = 10 * 60_000;
/** Tempo máximo esperando outro comando terminar. */
const LOCK_WAIT_MS = 60_000;

/**
 * Lock de processo para os CLIs mutantes: o store faz read-modify-write de arquivos
 * inteiros, então dois comandos simultâneos (ex.: tarefa agendada + comando manual)
 * perderiam atualizações um do outro. Um lockfile em `.outbound/.lock` serializa.
 * Lock com mais de 10 min é considerado órfão (processo morto) e roubado.
 */
export async function runExclusive<T>(
  label: string,
  fn: () => Promise<T>,
  dirOverride?: string,
): Promise<T> {
  try {
    process.loadEnvFile(".env.local"); // OUTBOUND_STORE_DIR pode vir do .env.local
  } catch {
    // sem .env.local — vale a env do shell
  }
  const dir = dirOverride ?? outboundDir();
  const lockPath = path.join(dir, ".lock");
  await fs.mkdir(dir, { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, label, at: new Date().toISOString() }) + "\n",
        "utf8",
      );
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

export function newId(): string {
  return randomUUID();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

  events(): Promise<OutboundEvent[]>;
  /** Append-only com dedupe por sourceKey. Retorna true se registrou. */
  appendEvent(event: Omit<OutboundEvent, "id" | "recordedAt">): Promise<boolean>;

  state(): Promise<OutboundState>;
  saveState(state: OutboundState): Promise<void>;
}

export function openStore(dir = outboundDir()): OutboundStore {
  const file = (name: string) => path.join(dir, name);
  const collection = <T>(name: CollectionName) => readJson<T[]>(file(COLLECTIONS[name]), []);
  const saveCollection = (name: CollectionName, rows: unknown[]) =>
    writeJsonAtomic(file(COLLECTIONS[name]), rows);

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
