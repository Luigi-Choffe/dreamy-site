// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteSqlClient, ensureSchema, type SqlClient } from "../../src/lib/outbound/sql";
import { acquireDbLock, createPgStore, releaseDbLock } from "../../src/lib/outbound/store-pg";
import type { OutboundStore } from "../../src/lib/outbound/store";
import type { Contact, Deal, Demand, WorkspaceSettings } from "../../src/lib/outbound/types";

let db: PGlite;
let client: SqlClient;
let store: OutboundStore;

beforeAll(async () => {
  db = await PGlite.create();
  client = createPgliteSqlClient(db);
  await ensureSchema(client);
  await ensureSchema(client); // idempotente
  store = createPgStore(client, "/tmp/outbound-pg-test");
});

afterAll(async () => {
  await db.close();
});

function contact(id: string, email: string): Contact {
  return {
    id,
    email,
    nome: `Nome ${id}`,
    custom: { abertura: "linha" },
    importBatchId: "b1",
    verification: "ok",
    status: "active",
    createdAt: "2026-08-20T12:00:00Z",
  };
}

describe("store Postgres — coleções", () => {
  it("grava e lê contatos preservando a ordem e o conteúdo", async () => {
    await store.saveContacts([contact("c1", "a@x.com.br"), contact("c2", "b@x.com.br")]);
    const rows = await store.contacts();
    expect(rows.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(rows[0]?.custom.abertura).toBe("linha");
    expect((await store.contactByEmail("B@X.com.br"))?.id).toBe("c2");
  });

  it("regrava a coleção inteira (remove o que saiu)", async () => {
    await store.saveContacts([contact("c9", "z@x.com.br")]);
    expect((await store.contacts()).map((c) => c.id)).toEqual(["c9"]);
  });

  it("supressão é idempotente e normaliza o e-mail", async () => {
    expect(await store.suppress({ email: " Maria@ACME.com.br ", reason: "manual" })).toBe(true);
    expect(await store.suppress({ email: "maria@acme.com.br", reason: "unsubscribe" })).toBe(false);
    expect(await store.isSuppressed("MARIA@acme.com.br")).toBe(true);
    expect((await store.suppressions())[0]?.reason).toBe("manual");
  });

  it("eventos deduplicam por sourceKey e mantêm ordem", async () => {
    const draft = {
      sendId: "s1",
      campaignSlug: "c",
      type: "delivered" as const,
      sourceKey: "sync:1:delivered",
      occurredAt: "2026-09-01T12:00:00Z",
    };
    expect(await store.appendEvent(draft)).toBe(true);
    expect(await store.appendEvent(draft)).toBe(false);
    expect(await store.appendEvent({ ...draft, sourceKey: "sync:1:opened", type: "opened" })).toBe(true);
    expect((await store.events()).map((e) => e.type)).toEqual(["delivered", "opened"]);
  });

  it("state tem default seguro e faz upsert", async () => {
    expect((await store.state()).armed).toBe(false);
    await store.saveState({ armed: true, armedAt: "2026-09-01T12:00:00Z" });
    await store.saveState({ armed: true, armedAt: "2026-09-01T12:00:00Z", dailyCapOverride: 5 });
    expect((await store.state()).dailyCapOverride).toBe(5);
  });

  it("runtimes de campanha usam o slug como id", async () => {
    await store.saveCampaignRuntimes([{ slug: "x", approvedAt: "2026-09-01T12:00:00Z" }]);
    expect((await store.campaignRuntimes())[0]?.slug).toBe("x");
  });

  it("coleções do CRM fazem roundtrip e settings é singleton regravável", async () => {
    const deal: Deal = {
      id: "d1",
      contactId: "c9",
      campaignSlug: "construcao-nova-receita",
      empresa: "Construtora X",
      stage: "respondeu",
      autoStage: "respondeu",
      stageHistory: [{ stage: "novo", at: "2026-08-20T12:00:00Z", by: "sistema" }],
      stageChangedAt: "2026-08-25T12:00:00Z",
      stageChangedBy: "sistema",
      createdAt: "2026-08-20T12:00:00Z",
    };
    await store.saveDeals([deal]);
    expect((await store.deals())[0]?.stageHistory[0]?.stage).toBe("novo");

    const demand: Demand = {
      id: "dm1",
      title: "Segmentar lista de obras",
      kind: "leads",
      status: "pendente",
      priority: "alta",
      createdBy: "console",
      createdAt: "2026-08-30T12:00:00Z",
    };
    await store.saveDemands([demand]);
    expect((await store.demands())[0]?.kind).toBe("leads");

    const ws: WorkspaceSettings = {
      id: "workspace",
      empresaNome: "Dreamy",
      ofertas: [{ anchor: "sistema", titulo: "Sistemas Sob Medida", descricao: "Sistema para o processo da casa." }],
      atualizadoEm: "2026-08-30T12:00:00Z",
    };
    await store.saveWorkspaceSettings([ws]);
    await store.saveWorkspaceSettings([{ ...ws, empresaNome: "Cliente Piloto" }]);
    const rows = await store.workspaceSettings();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.empresaNome).toBe("Cliente Piloto");
  });
});

describe("store Postgres — lock distribuído", () => {
  it("segundo holder não pega lock vivo; release libera; lock vencido é roubado", async () => {
    expect(await acquireDbLock(client, "l1", "a", 60_000)).toBe(true);
    expect(await acquireDbLock(client, "l1", "b", 60_000)).toBe(false);
    await releaseDbLock(client, "l1", "b"); // holder errado não libera
    expect(await acquireDbLock(client, "l1", "b", 60_000)).toBe(false);
    await releaseDbLock(client, "l1", "a");
    expect(await acquireDbLock(client, "l1", "b", 60_000)).toBe(true);
    expect(await acquireDbLock(client, "l2", "a", -1)).toBe(true);
    expect(await acquireDbLock(client, "l2", "c", 60_000)).toBe(true);
  });
});
