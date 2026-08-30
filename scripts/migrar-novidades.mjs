// Cria a tabela das novidades da página de entrada.
//
//   DATABASE_URL="postgres://..." node scripts/migrar-novidades.mjs
//
// Idempotente: pode rodar duas vezes.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Rode com:\n  DATABASE_URL="postgres://..." node scripts/migrar-novidades.mjs',
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

await sql`
  CREATE TABLE IF NOT EXISTS novidades (
    id          SERIAL PRIMARY KEY,
    titulo      TEXT NOT NULL,
    texto       TEXT NOT NULL,
    -- quem escreveu. ON DELETE SET NULL porque a novidade continua valendo
    -- mesmo se a conta de quem publicou sumir depois.
    autor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    publicada   BOOLEAN NOT NULL DEFAULT true,
    criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

// a página de entrada busca as publicadas, mais recentes primeiro — é o único
// acesso que existe, e ele é público, então vale ter índice desde já
await sql`
  CREATE INDEX IF NOT EXISTS idx_novidades_publicadas
  ON novidades (publicada, criada_em DESC)
`;

const [{ n }] = await sql`SELECT count(*)::int AS n FROM novidades`;
console.log(`  tabela novidades pronta — ${n} registro(s)`);

await sql.end();
