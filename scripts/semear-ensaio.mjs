// Popula um PostgreSQL com dados que exercitam todas as tabelas do plano de
// migração, para o ensaio PostgreSQL → D1 ter o que conferir.
//
//   DATABASE_URL="postgres://..." node scripts/semear-ensaio.mjs
//
// Nunca aponte para produção: o script apaga tudo antes de semear.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Rode com: DATABASE_URL="postgres://..." node scripts/semear-ensaio.mjs',
  );
  process.exit(1);
}
if (/supabase|neon|prod/i.test(url)) {
  console.error("Essa URL parece de produção. O ensaio só roda contra banco descartável.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {} });

await sql`TRUNCATE auditoria_admin, fila_emails, gamificacao_eventos, bloqueios_constancia,
  indicacoes_recompensas, convites_porta_voz, ranking_aprovacoes, avaliacoes, denuncias,
  mensagens, ofertas, conquistas, portfolio, musicas, novidades, pautas, users
  RESTART IDENTITY CASCADE`;

const [admin] = await sql`
  INSERT INTO users (apelido, nome, email, papel, senha_hash)
  VALUES ('inspetor.ensaio', 'Inspetor Ensaio', 'inspetor@ensaio.local', 'admin', '$2a$10$ensaio')
  RETURNING id`;

const spokespeople = await sql`
  INSERT INTO users (apelido, nome, email, papel, senha_hash, perfil_completo, cargo)
  VALUES
    ('voz.um', 'Voz Um', 'voz.um@ensaio.local', 'voz', '$2a$10$ensaio', true, 'Vereador'),
    ('voz.dois', 'Voz Dois', 'voz.dois@ensaio.local', 'voz', '$2a$10$ensaio', true, 'Deputada')
  RETURNING id`;

const editors = await sql`
  INSERT INTO users (apelido, nome, email, papel, senha_hash, entregues, reputacao, streak, nota, ultimo_visto_em, perfil_completo)
  VALUES
    ('editor.um', 'Editor Um', 'editor.um@ensaio.local', 'editor', '$2a$10$ensaio', 12, 300, 4, 4.50, now(), true),
    ('editor.dois', 'Editor Dois', 'editor.dois@ensaio.local', 'editor', '$2a$10$ensaio', 3, 75, 1, 4.00, now(), true),
    ('editor.tres', 'Editor Tres', 'editor.tres@ensaio.local', 'editor', '$2a$10$ensaio', 0, 0, 0, NULL, now() - interval '2 days', false)
  RETURNING id`;

const [v1, v2] = spokespeople.map((row) => row.id);
const [e1, e2, e3] = editors.map((row) => row.id);

await sql`UPDATE users SET indicado_por_id = ${e1} WHERE id = ${e2}`;

const missions = await sql`
  INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id, reservada_em, pontuada, prioridade)
  VALUES
    (${v1}, 'Missão finalizada', 'short', 'finalizada', ${e1}, now() - interval '10 days', true, 0),
    (${v1}, 'Missão aprovada', 'longo', 'aprovada', ${e1}, now() - interval '5 days', true, 0),
    (${v2}, 'Missão em revisão', 'short', 'em_revisao', ${e2}, now() - interval '1 day', false, 1),
    (${v2}, 'Missão disponível', 'short', 'disponivel', NULL, NULL, false, 2),
    (${v1}, 'Missão oferecida', 'longo', 'oferecida', NULL, NULL, false, 0)
  RETURNING id`;
const [m1, m2, m3, m4, m5] = missions.map((row) => row.id);

await sql`
  INSERT INTO ofertas (pauta_id, editor_id, status, expira_em, ordem)
  VALUES (${m5}, ${e3}, 'pendente', now() + interval '5 minutes', 1),
         (${m1}, ${e1}, 'aceita', now() - interval '10 days', 1),
         (${m3}, ${e2}, 'aceita', now() - interval '1 day', 1)`;

await sql`
  INSERT INTO mensagens (pauta_id, autor_id, texto)
  VALUES (${m1}, ${v1}, 'Segue o material bruto.'),
         (${m1}, ${e1}, 'Recebido, começo hoje.'),
         (${m3}, ${e2}, 'Primeira versão enviada.')`;

await sql`INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario) VALUES (${m1}, ${e1}, 5, 'Ficou ótimo'), (${m2}, ${e1}, 4, NULL)`;
await sql`INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto, status) VALUES (${m3}, ${v2}, ${e2}, 'Atraso sem aviso', 'aberta')`;

// O TRUNCATE ... CASCADE em users alcança ranking_ciclos pela FK criado_por.
await sql`
  INSERT INTO ranking_ciclos (nome, termina_em)
  SELECT 'Ciclo de ensaio', now() + interval '90 days'
  WHERE NOT EXISTS (SELECT 1 FROM ranking_ciclos WHERE congelado_em IS NULL)`;
const [cycle] =
  await sql`SELECT id FROM ranking_ciclos WHERE congelado_em IS NULL ORDER BY inicia_em DESC LIMIT 1`;
await sql`
  INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por)
  VALUES (${m1}, ${cycle.id}, ${e1}, ${admin.id}), (${m2}, ${cycle.id}, ${e1}, ${admin.id})`;

await sql`
  INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em, usado_em, usado_por)
  VALUES ('voz.um@ensaio.local', ${"a".repeat(64)}, ${admin.id}, now() + interval '7 days', now() - interval '20 days', ${v1}),
         ('novo.voz@ensaio.local', ${"b".repeat(64)}, ${admin.id}, now() + interval '7 days', NULL, NULL)`;

await sql`INSERT INTO indicacoes_recompensas (convidado_id, convidador_id) VALUES (${e2}, ${e1})`;
await sql`INSERT INTO bloqueios_constancia (editor_id, concedido_por, motivo) VALUES (${e1}, ${admin.id}, 'Semana de prova na faculdade')`;
await sql`
  INSERT INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
  VALUES (${e1}, 'entrada_diaria', '2026-08-30', 10), (${e1}, 'missao_entregue', ${String(m1)}, 40)`;
await sql`INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes) VALUES (${admin.id}, 'edicao_aprovada', 'pauta', ${String(m1)}, '{"editorId":1}'::jsonb)`;

await sql`
  INSERT INTO fila_emails (chave, destinatario, assunto, html, enviado_em)
  VALUES ('ensaio:enviado', 'voz.um@ensaio.local', 'Entrega pronta', '<p>Pronto</p>', now()),
         ('ensaio:pendente', 'voz.dois@ensaio.local', 'Missão aceita', '<p>Aceita</p>', NULL)`;

// As cinco que faltavam no plano original.
await sql`
  INSERT INTO portfolio (user_id, titulo, formato, porta_voz, link_video)
  VALUES (${e1}, 'Reel de campanha', 'short', 'Voz Um', 'https://exemplo.local/a'),
         (${e1}, 'Documentário curto', 'longo', 'Voz Um', 'https://exemplo.local/b'),
         (${e2}, 'Primeiro trabalho', 'short', 'Voz Dois', 'https://exemplo.local/c')`;
await sql`
  INSERT INTO conquistas (user_id, nome, icone)
  VALUES (${e1}, 'Primeira entrega', '🎬'), (${e1}, 'Dez entregas', '🏆'), (${e2}, 'Primeira entrega', '🎬')`;
await sql`
  INSERT INTO musicas (nome, tags, url, tamanho, adicionado_por)
  VALUES ('Trilha épica', ARRAY['epico','institucional'], 'https://exemplo.local/1.mp3', 4200000, ${admin.id}),
         ('Trilha leve', ARRAY['leve'], 'https://exemplo.local/2.mp3', 3100000, ${admin.id})`;
await sql`
  INSERT INTO novidades (titulo, texto, publicada, autor_id)
  VALUES ('Ranking eleitoral no ar', 'Agora o ranking conta.', true, ${admin.id}),
         ('Rascunho interno', 'Ainda não publicado.', false, ${admin.id})`;

const [counts] = await sql`
  SELECT (SELECT count(*) FROM users) AS usuarios,
         (SELECT count(*) FROM pautas) AS missoes,
         (SELECT count(*) FROM portfolio) AS portfolio,
         (SELECT count(*) FROM conquistas) AS conquistas,
         (SELECT count(*) FROM musicas) AS musicas,
         (SELECT count(*) FROM novidades) AS novidades`;
console.log("semeado:", JSON.stringify(counts));

await sql.end();
