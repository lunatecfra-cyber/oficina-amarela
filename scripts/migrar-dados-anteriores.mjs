// Script de migração e backfill de dados legados para o novo formato
// Idempotente — seguro para rodar em desenvolvimento e produção.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não configurado");

const sql = postgres(url, { prepare: false });

console.log("Iniciando migração de dados legados...");

// 1. Garantir que todo usuário existente possui código de indicação único
const codigosAtualizados = await sql`
  UPDATE users
  SET codigo_indicacao = gen_random_uuid()
  WHERE codigo_indicacao IS NULL
  RETURNING id
`;
console.log(`  ✓ Códigos de indicação: ${codigosAtualizados.length} usuário(s) atualizado(s)`);

// 2. Garantir ciclo eleitoral ativo
await sql`
  INSERT INTO ranking_ciclos (nome, termina_em)
  SELECT 'Eleições gerais de 2026', '2026-10-26 02:59:59.999+00'
  WHERE NOT EXISTS (SELECT 1 FROM ranking_ciclos WHERE congelado_em IS NULL)
`;
console.log("  ✓ Ciclo eleitoral verificado");

// 3. Backfill de aprovações anteriores para o ranking
const aprovacoesBackfill = await sql`
  INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por, aprovado_em)
  SELECT p.id,
         c.id,
         p.reservada_por_id,
         p.porta_voz_id,
         coalesce(p.criada_em, now())
  FROM pautas p
  CROSS JOIN (
    SELECT id FROM ranking_ciclos
    WHERE congelado_em IS NULL
    ORDER BY inicia_em DESC LIMIT 1
  ) c
  WHERE p.status IN ('aprovada', 'finalizada')
    AND p.reservada_por_id IS NOT NULL
  ON CONFLICT (pauta_id) DO NOTHING
  RETURNING pauta_id
`;
console.log(`  ✓ Backfill do ranking: ${aprovacoesBackfill.length} aprovação(ões) sincronizada(s)`);

// 4. Marcação de pautas aprovadas como pontuadas
await sql`
  UPDATE pautas
  SET pontuada = true
  WHERE status IN ('aprovada', 'finalizada') AND pontuada = false
`;
console.log("  ✓ Status de pontuação das pautas atualizado");

// 5. Garantir regras de gamificação ativas
await sql`
  INSERT INTO gamificacao_regras (id, titulo, descricao, xp, ciclo)
  VALUES
    ('entrada_diaria', 'Entrou no site', 'Acesse a Oficina Amarela hoje.', 10, 'daily'),
    ('missao_entregue', 'Entregue uma missão hoje', 'Envie uma edição válida para revisão.', 40, 'one_time')
  ON CONFLICT (id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    xp = EXCLUDED.xp,
    ciclo = EXCLUDED.ciclo,
    ativa = true
`;
console.log("  ✓ Regras de gamificação sincronizadas");

await sql.end();
console.log("Migração de dados legados concluída com sucesso.");
