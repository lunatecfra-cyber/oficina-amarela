// Backup do banco de produção, em JSON, na sua máquina.
//
// Por que não é uma ação automática do GitHub: o repositório é PÚBLICO, e
// artifact de repositório público é baixável por qualquer pessoa. O dump tem
// e-mail e hash de senha de todo mundo — publicar isso seria pior do que não
// ter backup. Automatizar exige um repositório privado ou um bucket, e nenhum
// dos dois existe hoje.
//
// Por que JSON e não pg_dump: pg_dump precisa do binário do Postgres instalado
// e da versão casando com a do servidor. Isto roda com o que o projeto já tem.
// Para restaurar, os dados estão em formato óbvio e a ordem das tabelas no
// arquivo já respeita as dependências entre elas.
//
//   node scripts/backup.mjs                  → usa DATABASE_URL do ambiente
//   DATABASE_URL="postgres://..." node scripts/backup.mjs
//
// Guarde o arquivo fora do repositório. Ele NÃO deve ser versionado.

import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Rode com:\n  DATABASE_URL=\"postgres://...\" node scripts/backup.mjs");
  process.exit(1);
}

// ordem importa numa eventual restauração: users antes de pautas, pautas antes
// do que aponta pra elas
const TABELAS = [
  "users",
  "pautas",
  "ofertas",
  "avaliacoes",
  "mensagens",
  "denuncias",
  "portfolio",
  "conquistas",
  "tentativas_login",
];

const sql = postgres(url, { prepare: false });

const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const pasta = process.env.BACKUP_DIR || join(process.cwd(), "backups");
mkdirSync(pasta, { recursive: true });

const dump = { gerado_em: new Date().toISOString(), tabelas: {} };
let total = 0;

for (const t of TABELAS) {
  const [existe] = await sql`
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${t}
  `;
  if (!existe) {
    console.log(`  ${t.padEnd(18)} (não existe, pulando)`);
    continue;
  }
  const linhas = await sql`SELECT * FROM ${sql(t)}`;
  dump.tabelas[t] = linhas;
  total += linhas.length;
  console.log(`  ${t.padEnd(18)} ${String(linhas.length).padStart(5)} linhas`);
}

const destino = join(pasta, `oficina-amarela-${carimbo}.json`);
writeFileSync(destino, JSON.stringify(dump, null, 2), "utf8");

console.log(`\n  ${total} linhas no total`);
console.log(`  salvo em: ${destino}`);
console.log(`\n  Guarde fora do repositório — tem e-mail e hash de senha.`);

await sql.end();
