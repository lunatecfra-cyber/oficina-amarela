// Cria a tabela de músicas da biblioteca de ferramentas.
//
//   DATABASE_URL="postgres://..." node scripts/migrar-musicas.mjs
//
// Idempotente: pode rodar duas vezes.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL. Rode com:\n  DATABASE_URL="postgres://..." node scripts/migrar-musicas.mjs');
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

await sql`
  CREATE TABLE IF NOT EXISTS musicas (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome            TEXT NOT NULL,
    tags            TEXT[] DEFAULT '{}',
    url             TEXT NOT NULL,
    tamanho         INTEGER,
    adicionado_por  INT REFERENCES users(id) ON DELETE SET NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS idx_musicas_tags ON musicas USING GIN(tags)`;
await sql`CREATE INDEX IF NOT EXISTS idx_musicas_criado ON musicas (criado_em DESC)`;

const [{ n }] = await sql`SELECT count(*)::int AS n FROM musicas`;
console.log(`  tabela musicas pronta — ${n} registro(s)`);

await sql.end();
