/** Lista de conexão LinkedIn da campanha (ação conjunta e-mail + connect). */
import { writeFileSync } from "node:fs";
import { openStore } from "../../src/lib/outbound/store";
const slug = "construcao-nova-receita";
async function main() {
  const store = openStore();
  const [contacts, enrollments, companies] = await Promise.all([
    store.contacts(),
    store.enrollments(),
    store.companies(),
  ]);
  const compByDomain = new Map(companies.map((c) => [c.dominio, c]));
  const rows = enrollments
    .filter((e) => e.campaignSlug === slug)
    .map((e) => contacts.find((c) => c.id === e.contactId)!)
    .map((c) => ({
      nome: `${c.nome}${c.sobrenome ? " " + c.sobrenome : ""}`,
      cargo: c.cargo ?? "",
      empresa: c.empresa ?? "",
      linkedin: c.linkedin ?? "",
      linkedinEmpresa: compByDomain.get(c.dominio ?? "")?.linkedin ?? "",
      abertura: (c.custom.abertura ?? "").slice(0, 120),
    }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa));
  console.log(`inscritos: ${rows.length} | com LinkedIn pessoal: ${rows.filter((r) => r.linkedin).length}`);
  const li = rows
    .map(
      (r) => `<tr>
<td style="padding:8px 12px;border-bottom:1px solid #e3e8e5"><b>${r.nome}</b><br><span style="color:#5c6660;font-size:12px">${r.cargo}</span></td>
<td style="padding:8px 12px;border-bottom:1px solid #e3e8e5">${r.empresa}</td>
<td style="padding:8px 12px;border-bottom:1px solid #e3e8e5">${r.linkedin ? `<a href="${r.linkedin}">perfil</a>` : `<span style=\"color:#b3261e\">sem perfil</span>${r.linkedinEmpresa ? ` · <a href=\"${r.linkedinEmpresa}\">página da empresa</a>` : ""}`}</td>
<td style="padding:8px 12px;border-bottom:1px solid #e3e8e5;font-size:12px;color:#5c6660">${r.abertura}…</td>
</tr>`,
    )
    .join("\n");
  writeFileSync(
    process.argv[2]!,
    `<!doctype html><meta charset="utf-8"><title>Conexões LinkedIn — campanha construção</title>
<body style="font-family:Arial,sans-serif;margin:24px;color:#0b0b0c"><h2>Ação LinkedIn — 16 contatos da campanha construção</h2>
<p style="color:#5c6660;font-size:13px">Convite SEM mensagem (aceitação maior) ou com nota curta que NÃO mencione o e-mail. Conectar depois do almoço de segunda (o e-mail chega de manhã).</p>
<table style="border-collapse:collapse;font-size:14px"><tr style="text-align:left;background:#f1f3f4"><th style="padding:8px 12px">Contato</th><th style="padding:8px 12px">Empresa</th><th style="padding:8px 12px">LinkedIn</th><th style="padding:8px 12px">Contexto (abertura do e-mail)</th></tr>
${li}</table></body>`,
    "utf8",
  );
  console.log("gerado:", process.argv[2]);
}
main();
