// Cria as invariantes de concorrência da fila de missões no banco.
//
//   DATABASE_URL="postgres://..." node scripts/migrar-invariantes-concorrencia.mjs
//
// Idempotente quando os dados estão limpos. Quando não estão, ele NÃO apaga
// nada: aponta os conflitos e sai com erro, porque decidir qual missão o editor
// perde é decisão humana.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Rode com:\n  DATABASE_URL="postgres://..." node scripts/migrar-invariantes-concorrencia.mjs',
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

try {
  const duplicateMissions = await sql`
    SELECT reservada_por_id AS editor_id,
           count(*)::int AS total,
           array_agg(id ORDER BY reservada_em) AS pauta_ids
    FROM pautas
    WHERE reservada_por_id IS NOT NULL
      AND status IN ('reservada', 'em_revisao', 'reedicao')
    GROUP BY reservada_por_id
    HAVING count(*) > 1
  `;

  const duplicateOffers = await sql`
    SELECT pauta_id, editor_id,
           count(*)::int AS total,
           array_agg(id ORDER BY oferecida_em) AS oferta_ids
    FROM ofertas
    GROUP BY pauta_id, editor_id
    HAVING count(*) > 1
  `;

  if (duplicateMissions.length > 0 || duplicateOffers.length > 0) {
    console.error("\nDados conflitam com as invariantes. Nada foi alterado.\n");

    for (const row of duplicateMissions) {
      console.error(
        `  editor ${row.editor_id} segura ${row.total} missões ativas: ${row.pauta_ids.join(", ")}`,
      );
    }
    for (const row of duplicateOffers) {
      console.error(
        `  missão ${row.pauta_id} tem ${row.total} ofertas para o editor ${row.editor_id}: ${row.oferta_ids.join(", ")}`,
      );
    }

    console.error(
      "\nResolva manualmente (liberar a missão extra, remover a oferta duplicada) e rode de novo.",
    );
    process.exit(1);
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pautas_missao_ativa_por_editor
    ON pautas (reservada_por_id)
    WHERE reservada_por_id IS NOT NULL
      AND status IN ('reservada', 'em_revisao', 'reedicao')
  `;
  console.log("  idx_pautas_missao_ativa_por_editor — uma missão ativa por editor");

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_missao_editor
    ON ofertas (pauta_id, editor_id)
  `;
  console.log("  idx_ofertas_missao_editor — uma oferta por (missão, editor)");

  console.log("\ninvariantes de concorrência aplicadas");
} finally {
  await sql.end();
}
