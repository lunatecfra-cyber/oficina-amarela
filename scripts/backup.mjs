// Backup do banco PostgreSQL, em JSON, na sua máquina.
//
// Por que não é uma ação automática do GitHub: o repositório é PÚBLICO, e
// artifact de repositório público é baixável por qualquer pessoa. O dump tem
// e-mail e hash de senha de todo mundo — publicar isso seria pior do que não
// ter backup. Automatizar exige um repositório privado ou um bucket, e nenhum
// dos dois existe hoje.
//
// Por que JSON e não pg_dump: pg_dump precisa do binário do Postgres instalado
// e da versão casando com a do servidor. Isto roda com o que o projeto já tem.
//
// AS TABELAS SAEM DO information_schema, não de uma lista escrita aqui.
// A lista fixa anterior cobria 9 tabelas de 21: o backup saía "com sucesso" e
// sem ranking eleitoral, convites, indicações, gamificação, auditoria, fila de
// e-mails, acervo de músicas nem novidades. Um backup que perde metade do
// banco em silêncio é pior que nenhum, porque ninguém procura o que acha que
// tem. Tabela nova entra sozinha, sem ninguém lembrar de nada.
//
//   node scripts/backup.mjs                  → usa DATABASE_URL do ambiente
//   DATABASE_URL="postgres://..." node scripts/backup.mjs
//
// Guarde o arquivo fora do repositório. Ele NÃO deve ser versionado.
// Para voltar: scripts/restaurar.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Rode com:\n  DATABASE_URL="postgres://..." node scripts/backup.mjs',
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

/**
 * Ordem de dependência: uma tabela só vem depois de quem ela referencia.
 *
 * A restauração insere na ordem do arquivo, então a ordem É o dado. Ciclo de
 * chave estrangeira (users.indicado_por_id aponta para users) é ignorado: a
 * auto-referência se resolve na mesma tabela.
 */
async function tablesInDependencyOrder() {
  const tables = await sql`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const deps = await sql`
    SELECT src.relname AS child, tgt.relname AS parent
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class tgt ON tgt.oid = c.confrelid
    WHERE c.contype = 'f' AND src.relname <> tgt.relname
  `;

  const names = tables.map((row) => row.name);
  const parents = new Map(names.map((name) => [name, new Set()]));
  for (const { child, parent } of deps) {
    if (parents.has(child) && parents.has(parent)) parents.get(child).add(parent);
  }

  const ordered = [];
  const placed = new Set();
  while (ordered.length < names.length) {
    const ready = names.filter(
      (name) => !placed.has(name) && [...parents.get(name)].every((p) => placed.has(p)),
    );
    // Ciclo entre tabelas diferentes não deveria existir; se existir, o resto
    // entra na ordem alfabética em vez de o backup travar.
    const batch = ready.length ? ready : names.filter((name) => !placed.has(name));
    for (const name of batch) {
      ordered.push(name);
      placed.add(name);
    }
  }
  return ordered;
}

const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const pasta = process.env.BACKUP_DIR || join(process.cwd(), "backups");
mkdirSync(pasta, { recursive: true });

const tabelas = await tablesInDependencyOrder();
const dump = { gerado_em: new Date().toISOString(), ordem: tabelas, tabelas: {} };
let total = 0;

for (const t of tabelas) {
  const linhas = await sql`SELECT * FROM ${sql(t)}`;
  dump.tabelas[t] = linhas;
  total += linhas.length;
  console.log(`  ${t.padEnd(24)} ${String(linhas.length).padStart(6)} linhas`);
}

const destino = join(pasta, `oficina-amarela-${carimbo}.json`);
writeFileSync(destino, JSON.stringify(dump, null, 2), "utf8");

console.log(`\n  ${tabelas.length} tabelas, ${total} linhas no total`);
console.log(`  salvo em: ${destino}`);
console.log("\n  Guarde fora do repositório — tem e-mail e hash de senha.");
console.log("  Para voltar:  node scripts/restaurar.mjs --arquivo <caminho>");

await sql.end();
