import { randomUUID } from "node:crypto";
import type { SqlClient, SqlStatement } from "./sql";
import { DEFAULT_STATE, normalizeEmail } from "./store-common";
import type { OutboundStore } from "./store";
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

/**
 * OutboundStore sobre Postgres (ADR-023). Mesma semântica do store em arquivos:
 * cada coleção é lida/gravada inteira (volumes pequenos, um operador), documentos
 * em JSONB — o console na Vercel e os CLIs na máquina do operador compartilham
 * o mesmo banco. `dir` continua sendo o diretório LOCAL para snapshots/relatórios.
 */

type CollectionName =
  | "contacts"
  | "companies"
  | "campaigns"
  | "enrollments"
  | "sends"
  | "suppressions"
  | "replies"
  | "imports"
  | "deals"
  | "notes"
  | "tasks"
  | "demands"
  | "agentActivities"
  | "briefings"
  | "settings";

const INSERT_CHUNK = 200;

function idOf(name: CollectionName, row: Record<string, unknown>): string {
  if (name === "suppressions") return normalizeEmail(String(row.email));
  if (name === "campaigns") return String(row.slug);
  return String(row.id);
}

export function createPgStore(client: SqlClient, dir: string): OutboundStore {
  async function collection<T>(name: CollectionName): Promise<T[]> {
    const rows = await client.query<{ data: T }>(
      "SELECT data FROM outbound_documents WHERE collection = $1 ORDER BY seq",
      [name],
    );
    return rows.map((r) => r.data);
  }

  async function saveCollection(name: CollectionName, rows: unknown[]): Promise<void> {
    const statements: SqlStatement[] = [
      { text: "DELETE FROM outbound_documents WHERE collection = $1", params: [name] },
    ];
    const docs = rows as Array<Record<string, unknown>>;
    for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
      const chunk = docs.slice(i, i + INSERT_CHUNK);
      const values: string[] = [];
      const params: unknown[] = [];
      chunk.forEach((row, j) => {
        const base = j * 3;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}::jsonb)`);
        params.push(name, idOf(name, row), JSON.stringify(row));
      });
      statements.push({
        text: `INSERT INTO outbound_documents (collection, id, data) VALUES ${values.join(", ")}`,
        params,
      });
    }
    await client.transaction(statements);
  }

  return {
    dir,

    contacts: () => collection<Contact>("contacts"),
    saveContacts: (rows) => saveCollection("contacts", rows),
    async contactByEmail(email) {
      const rows = await client.query<{ data: Contact }>(
        "SELECT data FROM outbound_documents WHERE collection = 'contacts' AND data->>'email' = $1 LIMIT 1",
        [normalizeEmail(email)],
      );
      return rows[0]?.data;
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
      const rows = await client.query<{ ok: number }>(
        "SELECT 1 AS ok FROM outbound_documents WHERE collection = 'suppressions' AND id = $1",
        [normalizeEmail(email)],
      );
      return rows.length > 0;
    },
    async suppress(entry) {
      const email = normalizeEmail(entry.email);
      const row: Suppression = { ...entry, email, createdAt: new Date().toISOString() };
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO outbound_documents (collection, id, data) VALUES ('suppressions', $1, $2::jsonb)
         ON CONFLICT (collection, id) DO NOTHING RETURNING id`,
        [email, JSON.stringify(row)],
      );
      return inserted.length > 0;
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

    async events() {
      const rows = await client.query<{ data: OutboundEvent }>("SELECT data FROM outbound_events ORDER BY seq");
      return rows.map((r) => r.data);
    },
    async appendEvent(event) {
      const full: OutboundEvent = { ...event, id: randomUUID(), recordedAt: new Date().toISOString() };
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO outbound_events (id, source_key, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (source_key) DO NOTHING RETURNING id`,
        [full.id, full.sourceKey, JSON.stringify(full)],
      );
      return inserted.length > 0;
    },

    async state() {
      const rows = await client.query<{ data: OutboundState }>("SELECT data FROM outbound_state WHERE id = 1");
      return rows[0]?.data ?? DEFAULT_STATE;
    },
    async saveState(state) {
      await client.query(
        `INSERT INTO outbound_state (id, data) VALUES (1, $1::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(state)],
      );
    },
  };
}

// ─── Lock distribuído (mesma semântica do lockfile: TTL + roubo de lock órfão) ──

export async function acquireDbLock(client: SqlClient, name: string, holder: string, ttlMs: number): Promise<boolean> {
  const rows = await client.query<{ name: string }>(
    `INSERT INTO outbound_locks (name, holder, expires_at)
     VALUES ($1, $2, now() + ($3::text || ' milliseconds')::interval)
     ON CONFLICT (name) DO UPDATE
       SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
       WHERE outbound_locks.expires_at < now()
     RETURNING name`,
    [name, holder, String(ttlMs)],
  );
  return rows.length > 0;
}

export async function releaseDbLock(client: SqlClient, name: string, holder: string): Promise<void> {
  await client.query("DELETE FROM outbound_locks WHERE name = $1 AND holder = $2", [name, holder]);
}
