import { writeFileSync } from "node:fs";
import { openStore } from "../../src/lib/outbound/store";
const out = process.argv[2] as string;
openStore()
  .companies()
  .then((cs) => {
    const rows = cs.map((c) => ({
      dominio: c.dominio,
      nome: c.nome,
      porte: c.porte ?? null,
      local: c.local ?? null,
      clientes: c.custom.clientes_ativos ?? null,
      ticket: c.custom.ticket_medio ?? null,
      descricao: (c.descricao ?? "").slice(0, 600),
    }));
    writeFileSync(out, JSON.stringify(rows, null, 1), "utf8");
    console.log("dump:", rows.length, "| com descrição:", rows.filter((r) => r.descricao.length > 30).length);
  });
