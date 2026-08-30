import { sql } from "@/lib/db";
import { calculateConsistency, calculateUnlockedAwards } from "@/lib/electoral-ranking";

export async function cancelElectoralApproval(
  missionId: number,
  inspectorId: number,
  reason: string,
) {
  if (!reason.trim())
    return {
      ok: false as const,
      error: "Informe o motivo da correção.",
      erro: "Informe o motivo da correção.",
    };
  const [record] = await sql`
    WITH anulada AS (
      UPDATE ranking_aprovacoes
      SET anulado_em = now(), anulado_por = ${inspectorId}, motivo_anulacao = ${reason.trim()}
      WHERE pauta_id = ${missionId} AND anulado_em IS NULL
      RETURNING editor_id
    ), pauta_corrigida AS (
      UPDATE pautas SET pontuada = false
      WHERE id = ${missionId} AND EXISTS (SELECT 1 FROM anulada)
      RETURNING id
    ), avaliacao_removida AS (
      DELETE FROM avaliacoes
      WHERE pauta_id = ${missionId} AND EXISTS (SELECT 1 FROM anulada)
      RETURNING editor_id
    ), usuario_corrigido AS (
      UPDATE users u
      SET entregues = GREATEST(u.entregues - 1, 0),
          reputacao = GREATEST(u.reputacao - 25, 0),
          streak = GREATEST(u.streak - 1, 0),
          nota = (SELECT round(avg(a.nota)::numeric, 2)
                  FROM avaliacoes a WHERE a.editor_id = u.id AND a.pauta_id <> ${missionId})
      FROM anulada WHERE u.id = anulada.editor_id
      RETURNING u.id
    ), auditada AS (
      INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
      SELECT ${inspectorId}, 'aprovacao_anulada', 'pauta', ${String(missionId)},
             ${sql.json({ motivo: reason.trim() })}
      FROM anulada RETURNING id
    )
    SELECT editor_id FROM anulada
  `;
  if (!record)
    return {
      ok: false as const,
      error: "Esta aprovação não está ativa no ranking.",
      erro: "Esta aprovação não está ativa no ranking.",
    };
  await recalculateReferral(Number(record.editor_id), reason.trim());
  return { ok: true as const };
}
export const anularAprovacaoEleitoral = cancelElectoralApproval;

async function recalculateReferral(editorId: number, reason: string) {
  const [count] = await sql`
    SELECT count(*)::int AS total FROM ranking_aprovacoes
    WHERE editor_id = ${editorId} AND anulado_em IS NULL
  `;
  if (Number(count?.total ?? 0) >= 2) return;
  await sql`
    WITH revogada AS (
      UPDATE indicacoes_recompensas
      SET revogado_em = now(), motivo_revogacao = ${`Aprovação anulada: ${reason}`}
      WHERE convidado_id = ${editorId} AND revogado_em IS NULL
      RETURNING convidador_id, pontos
    )
    UPDATE users u
    SET reputacao = GREATEST(u.reputacao - revogada.pontos, 0)
    FROM revogada WHERE u.id = revogada.convidador_id
  `;
}

export async function awardReferralIfEligible(inviteeId: number) {
  const [reward] = await sql`
    WITH dados AS (
      SELECT u.indicado_por_id AS convidador_id,
             (SELECT count(*) FROM ranking_aprovacoes a
              WHERE a.editor_id = u.id AND a.anulado_em IS NULL) AS aprovacoes
      FROM users u WHERE u.id = ${inviteeId}
    ), elegivel AS (
      SELECT convidador_id FROM dados
      WHERE convidador_id IS NOT NULL AND aprovacoes >= 2
        AND (SELECT count(*) FROM indicacoes_recompensas r
             WHERE r.convidador_id = dados.convidador_id
               AND r.revogado_em IS NULL
               AND r.premiado_em >= date_trunc('month', now())) < 5
    ), inserida AS (
      INSERT INTO indicacoes_recompensas (convidado_id, convidador_id)
      SELECT ${inviteeId}, convidador_id FROM elegivel
      ON CONFLICT (convidado_id) DO NOTHING
      RETURNING convidador_id, pontos
    )
    UPDATE users u SET reputacao = u.reputacao + inserida.pontos
    FROM inserida WHERE u.id = inserida.convidador_id
    RETURNING u.id
  `;
  return !!reward;
}
export const premiarIndicacaoSeElegivel = awardReferralIfEligible;

export async function getElectoralRanking() {
  await sql`
    UPDATE ranking_ciclos SET congelado_em = termina_em
    WHERE congelado_em IS NULL AND termina_em < now()
  `;
  const items = await sql`
    SELECT u.id, u.apelido, u.nome, count(a.pauta_id)::int AS quantidade,
           max(a.aprovado_em) AS atingiu_quantidade_em
    FROM ranking_aprovacoes a
    JOIN ranking_ciclos c ON c.id = a.ciclo_id
    JOIN users u ON u.id = a.editor_id
    WHERE a.anulado_em IS NULL
      AND c.id = (SELECT id FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1)
    GROUP BY u.id, u.apelido, u.nome
    ORDER BY quantidade DESC, atingiu_quantidade_em ASC, u.id ASC
  `;

  const [activity] = await sql`
    WITH ciclo AS (
      SELECT * FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1
    ), semana AS (
      SELECT GREATEST(date_trunc('week', now()), inicia_em) AS inicio,
             LEAST(date_trunc('week', now()) + interval '7 days', termina_em) AS fim
      FROM ciclo
    ), meta AS (
      SELECT CASE WHEN ceil(extract(epoch FROM (fim - inicio)) / 86400) <= 4 THEN 1 ELSE 2 END AS valor,
             inicio, fim FROM semana
    )
    SELECT count(*)::int AS ativos
    FROM (
      SELECT a.editor_id
      FROM ranking_aprovacoes a, meta
      WHERE a.anulado_em IS NULL AND a.aprovado_em >= meta.inicio AND a.aprovado_em < meta.fim
      GROUP BY a.editor_id, meta.valor HAVING count(*) >= meta.valor
    ) editores
  `;
  const activeCount = Number(activity?.ativos ?? 0);
  const [cycle] = await sql`
    UPDATE ranking_ciclos
    SET max_editores_ativos = GREATEST(max_editores_ativos, ${activeCount})
    WHERE id = (SELECT id FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1)
    RETURNING id, nome, inicia_em, termina_em, congelado_em, max_editores_ativos
  `;
  const milestone = Number(cycle?.max_editores_ativos ?? activeCount);
  const awards = calculateUnlockedAwards(milestone);
  const eligibleForDraw: number[] = [];
  if (awards.includes("sorteio_constancia")) {
    for (const item of items) {
      const progress = await getEditorProgress(Number(item.id));
      if (progress.eligibleForDraw || progress.elegivelAoSorteio) {
        eligibleForDraw.push(Number(item.id));
      }
    }
  }
  return {
    items,
    itens: items,
    cycle,
    ciclo: cycle,
    activeEditors: activeCount,
    editoresAtivos: activeCount,
    highestActiveCount: milestone,
    maiorNumeroDeAtivos: milestone,
    awards,
    premios: awards,
    eligibleForDraw,
    elegiveisSorteio: eligibleForDraw,
  };
}
export const obterRankingEleitoral = getElectoralRanking;

export async function grantConsistencyShield(
  editorId: number,
  inspectorId: number,
  reason: string,
) {
  if (!reason.trim())
    return {
      ok: false as const,
      error: "Informe o motivo do bloqueio.",
      erro: "Informe o motivo do bloqueio.",
    };
  const [balance] = await sql`
    SELECT count(*)::int AS total FROM bloqueios_constancia
    WHERE editor_id = ${editorId} AND consumido_em IS NULL
  `;
  if (Number(balance?.total ?? 0) >= 2) {
    return {
      ok: false as const,
      error: "Editor já possui o máximo de dois bloqueios.",
      erro: "Editor já possui o máximo de dois bloqueios.",
    };
  }
  await sql`
    INSERT INTO bloqueios_constancia (editor_id, concedido_por, motivo)
    VALUES (${editorId}, ${inspectorId}, ${reason.trim()})
  `;
  await sql`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (${inspectorId}, 'bloqueio_concedido', 'editor', ${String(editorId)},
            ${sql.json({ motivo: reason.trim() })})
  `;
  return { ok: true as const };
}
export const concederBloqueio = grantConsistencyShield;

export async function getEditorProgress(editorId: number) {
  await processShields(editorId);
  const [row] = await sql`
    WITH ciclo AS (SELECT * FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1),
    semanas AS (
      SELECT inicio,
             LEAST(inicio + interval '7 days', ciclo.termina_em) AS fim,
             CASE WHEN ceil(extract(epoch FROM (LEAST(inicio + interval '7 days', ciclo.termina_em) - inicio)) / 86400) <= 4 THEN 1 ELSE 2 END AS meta
      FROM ciclo,
      LATERAL generate_series(date_trunc('week', ciclo.inicia_em), date_trunc('week', LEAST(now(), ciclo.termina_em)), interval '7 days') inicio
    ), resultados AS (
      SELECT s.inicio::date AS semana, s.meta, count(a.pauta_id)::int AS quantidade,
             count(a.pauta_id) >= s.meta AS cumpriu,
             EXISTS (SELECT 1 FROM bloqueios_constancia b
                     WHERE b.editor_id = ${editorId} AND b.consumido_semana = s.inicio::date) AS salvo
      FROM semanas s
      LEFT JOIN ranking_aprovacoes a ON a.editor_id = ${editorId}
        AND a.anulado_em IS NULL AND a.aprovado_em >= s.inicio AND a.aprovado_em < s.fim
      GROUP BY s.inicio, s.meta ORDER BY s.inicio
    )
    SELECT coalesce(jsonb_agg(resultados ORDER BY resultados.semana), '[]'::jsonb) AS semanas,
           (SELECT count(*)::int FROM bloqueios_constancia WHERE editor_id = ${editorId} AND consumido_em IS NULL) AS bloqueios,
           (SELECT codigo_indicacao::text FROM users WHERE id = ${editorId}) AS codigo_indicacao
    FROM resultados
  `;
  if (!row) {
    return {
      weeks: [] as Array<{
        week?: string;
        semana: string;
        goal?: number;
        meta: number;
        count?: number;
        quantidade: number;
        completed?: boolean;
        cumpriu: boolean;
        saved?: boolean;
        salvo: boolean;
      }>,
      semanas: [] as Array<{
        semana: string;
        meta: number;
        quantidade: number;
        cumpriu: boolean;
        salvo: boolean;
      }>,
      shields: 0,
      bloqueios: 0,
      referralCode: null as string | null,
      codigo_indicacao: null as string | null,
      sequence: 0,
      sequencia: 0,
      eligibleForDraw: false,
      elegivelAoSorteio: false,
    };
  }
  const weeks = Array.isArray(row.semanas)
    ? (row.semanas as Array<{ cumpriu: boolean; salvo: boolean }>)
    : [];
  const consistency = calculateConsistency(
    weeks.map((w) => w.cumpriu || w.salvo),
    0,
  );
  return {
    weeks: row.semanas,
    semanas: row.semanas,
    shields: Number(row.bloqueios ?? 0),
    bloqueios: Number(row.bloqueios ?? 0),
    referralCode: row.codigo_indicacao ? String(row.codigo_indicacao) : null,
    codigo_indicacao: row.codigo_indicacao ? String(row.codigo_indicacao) : null,
    sequence: consistency.sequence,
    sequencia: consistency.sequence,
    eligibleForDraw: consistency.eligibleForDraw,
    elegivelAoSorteio: consistency.eligibleForDraw,
  };
}
export const obterProgressoEditor = getEditorProgress;

async function processShields(editorId: number) {
  const weeks = await sql`
    WITH ciclo AS (SELECT * FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1),
    semanas AS (
      SELECT inicio,
             LEAST(inicio + interval '7 days', ciclo.termina_em) AS fim,
             CASE WHEN ceil(extract(epoch FROM (LEAST(inicio + interval '7 days', ciclo.termina_em) - inicio)) / 86400) <= 4 THEN 1 ELSE 2 END AS meta
      FROM ciclo,
      LATERAL generate_series(date_trunc('week', ciclo.inicia_em), date_trunc('week', LEAST(now(), ciclo.termina_em)) - interval '7 days', interval '7 days') inicio
    )
    SELECT s.inicio::date AS semana, count(a.pauta_id)::int >= s.meta AS cumpriu,
           EXISTS (SELECT 1 FROM bloqueios_constancia b
                   WHERE b.editor_id = ${editorId} AND b.consumido_semana = s.inicio::date) AS salvo
    FROM semanas s
    LEFT JOIN ranking_aprovacoes a ON a.editor_id = ${editorId}
      AND a.anulado_em IS NULL AND a.aprovado_em >= s.inicio AND a.aprovado_em < s.fim
    GROUP BY s.inicio, s.meta ORDER BY s.inicio
  `;

  let sequence = 0;
  for (const week of weeks) {
    if (week.cumpriu || week.salvo) {
      sequence += 1;
      continue;
    }
    if (sequence === 0) continue;
    const [consumed] = await sql`
      UPDATE bloqueios_constancia
      SET consumido_semana = ${week.semana}, consumido_em = now()
      WHERE id = (
        SELECT id FROM bloqueios_constancia
        WHERE editor_id = ${editorId} AND consumido_em IS NULL
        ORDER BY concedido_em LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `;
    if (consumed) sequence += 1;
    else sequence = 0;
  }
}
