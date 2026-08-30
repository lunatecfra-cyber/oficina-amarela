// Dá à missão um lugar na fila que o inspetor pode mudar.
//
//   DATABASE_URL="postgres://..." node scripts/migrar-prioridade.mjs
//
// Idempotente: pode rodar duas vezes.
//
// Até aqui a fila era sempre "mais antiga primeiro" (criada_em ASC), sem
// ninguém podendo furar. `prioridade` é o desempate: maior vem antes, e o
// padrão 0 mantém exatamente a ordem de hoje pra tudo que já existe.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Rode com:\n  DATABASE_URL="postgres://..." node scripts/migrar-prioridade.mjs',
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

await sql`ALTER TABLE pautas ADD COLUMN IF NOT EXISTS prioridade INT NOT NULL DEFAULT 0`;

// a fila de edição lê por (prioridade, criada_em) toda vez que alguém abre o
// painel e a cada rodada de despacho — vale o índice
await sql`
  CREATE INDEX IF NOT EXISTS idx_pautas_fila
  ON pautas (prioridade DESC, criada_em ASC)
  WHERE status IN ('disponivel','oferecida')
`;

const [{ n }] = await sql`
  SELECT count(*)::int AS n FROM pautas WHERE status IN ('disponivel','oferecida')
`;
console.log(`  coluna prioridade pronta — ${n} missão(ões) na fila`);

await sql.end();
