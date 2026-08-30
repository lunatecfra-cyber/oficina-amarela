// Testes de integração da concorrência da fila de missões.
//
// Precisam de um PostgreSQL de verdade — as invariantes que eles cobrem moram
// em índices únicos, não em código. Sem TEST_DATABASE_URL eles são pulados,
// então `npm test` continua verde em máquina sem banco.
//
//   docker run -d --rm --name oficina-pg -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=oficina -p 5439:5432 postgres:16-alpine
//   DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" node scripts/migrar.mjs
//   TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL
  ? false
  : "TEST_DATABASE_URL não configurado — veja o cabeçalho do arquivo";

describe("concorrência da fila de missões", { skip }, async () => {
  const { sql } = await import("@/lib/db");
  const { reserveMission } = await import("@/lib/missions-db");
  const { acceptOffer, dispatchMissions, rejectOffer, markEditorActive } = await import(
    "@/lib/queue-db"
  );

  let spokespersonId: number;
  let editorIds: number[];

  async function createMission(status = "disponivel") {
    const [row] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, status)
      VALUES (${spokespersonId}, 'Missão de teste', 'short', ${status})
      RETURNING id
    `;
    return row.id as number;
  }

  async function missionRow(id: number) {
    const [row] = await sql`
      SELECT status, reservada_por_id FROM pautas WHERE id = ${id}
    `;
    return row as { status: string; reservada_por_id: number | null };
  }

  async function activeMissionCount(editorId: number) {
    const [row] = await sql`
      SELECT count(*)::int AS total FROM pautas
      WHERE reservada_por_id = ${editorId}
        AND status IN ('reservada', 'em_revisao', 'reedicao')
    `;
    return row.total as number;
  }

  before(async () => {
    // TRUNCATE ... CASCADE avisa sobre cada tabela alcançada; não interessa aqui.
    await sql`SET client_min_messages TO warning`;

    // Confere que as invariantes existem: sem elas metade destes testes passa
    // por acidente.
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('idx_pautas_missao_ativa_por_editor', 'idx_ofertas_missao_editor')
    `;
    assert.equal(
      indexes.length,
      2,
      "aplique supabase/schema.sql (ou scripts/migrar-invariantes-concorrencia.mjs) antes",
    );
  });

  beforeEach(async () => {
    // Aquece o pool: com uma única conexão aberta o driver serializa as
    // chamadas e a corrida nunca acontece — os testes passariam sem provar nada.
    await Promise.all(Array.from({ length: 4 }, () => sql`SELECT 1`));

    await sql`TRUNCATE ofertas, avaliacoes, mensagens, denuncias, ranking_aprovacoes, pautas, users RESTART IDENTITY CASCADE`;

    const [spokesperson] = await sql`
      INSERT INTO users (apelido, nome, email, papel)
      VALUES ('porta.voz', 'Porta Voz', 'voz@teste.local', 'voz')
      RETURNING id
    `;
    spokespersonId = spokesperson.id;

    const editors = await sql`
      INSERT INTO users (apelido, nome, email, papel, ultimo_visto_em)
      VALUES
        ('editor.um', 'Editor Um', 'um@teste.local', 'editor', now()),
        ('editor.dois', 'Editor Dois', 'dois@teste.local', 'editor', now()),
        ('editor.tres', 'Editor Tres', 'tres@teste.local', 'editor', now())
      RETURNING id
    `;
    editorIds = editors.map((e) => e.id as number);
  });

  test("um editor não fica com duas missões ao reservar em paralelo", async () => {
    const missions = [await createMission(), await createMission(), await createMission()];
    const [editorId] = editorIds;

    const results = await Promise.all(missions.map((id) => reserveMission(id, editorId)));

    // Sem idx_pautas_missao_ativa_por_editor este assert vira 3: as três
    // checagens prévias rodam antes de qualquer UPDATE confirmar.

    assert.equal(
      results.filter((r) => r.ok).length,
      1,
      "exatamente uma reserva deve vencer a corrida",
    );
    assert.equal(await activeMissionCount(editorId), 1);

    for (const result of results.filter((r) => !r.ok)) {
      assert.equal((result as { error: string }).error, "Você já tem uma missão em mãos.");
    }
  });

  test("uma missão não vai para dois editores ao mesmo tempo", async () => {
    const missionId = await createMission();

    const results = await Promise.all(editorIds.map((id) => reserveMission(missionId, id)));

    assert.equal(results.filter((r) => r.ok).length, 1);
    const mission = await missionRow(missionId);
    assert.equal(mission.status, "reservada");
    assert.ok(editorIds.includes(mission.reservada_por_id as number));
  });

  test("aceitar oferta de missão que já voltou para a fila não confirma nada", async () => {
    const missionId = await createMission("oferecida");
    const [editorId] = editorIds;
    await sql`
      INSERT INTO ofertas (pauta_id, editor_id, expira_em)
      VALUES (${missionId}, ${editorId}, now() + interval '5 minutes')
    `;

    // Corrida real: o sweep de expiração devolveu a missão para a fila entre a
    // oferta e o clique do editor.
    await sql`UPDATE pautas SET status = 'disponivel' WHERE id = ${missionId}`;

    const result = await acceptOffer(missionId, editorId);

    assert.equal(result.ok, false, "não pode responder ok para missão que o editor não pegou");
    const mission = await missionRow(missionId);
    assert.equal(mission.reservada_por_id, null);
    assert.equal(await activeMissionCount(editorId), 0);
  });

  test("aceitar oferta válida entrega a missão e fecha a oferta", async () => {
    const missionId = await createMission("oferecida");
    const [editorId] = editorIds;
    await sql`
      INSERT INTO ofertas (pauta_id, editor_id, expira_em)
      VALUES (${missionId}, ${editorId}, now() + interval '5 minutes')
    `;

    const result = await acceptOffer(missionId, editorId);

    assert.equal(result.ok, true);
    const mission = await missionRow(missionId);
    assert.equal(mission.status, "reservada");
    assert.equal(mission.reservada_por_id, editorId);

    const [offer] = await sql`
      SELECT status FROM ofertas WHERE pauta_id = ${missionId} AND editor_id = ${editorId}
    `;
    assert.equal(offer.status, "aceita");
  });

  test("editor com missão em mãos não consegue aceitar outra oferta", async () => {
    const [editorId] = editorIds;
    const held = await createMission();
    assert.equal((await reserveMission(held, editorId)).ok, true);

    const offered = await createMission("oferecida");
    await sql`
      INSERT INTO ofertas (pauta_id, editor_id, expira_em)
      VALUES (${offered}, ${editorId}, now() + interval '5 minutes')
    `;

    const result = await acceptOffer(offered, editorId);

    assert.equal(result.ok, false);
    assert.equal(await activeMissionCount(editorId), 1);
    assert.equal((await missionRow(offered)).status, "oferecida");
  });

  test("recusar oferta devolve a missão para a fila no mesmo comando", async () => {
    const missionId = await createMission("oferecida");
    const [editorId] = editorIds;
    await sql`
      INSERT INTO ofertas (pauta_id, editor_id, expira_em)
      VALUES (${missionId}, ${editorId}, now() + interval '5 minutes')
    `;

    assert.equal((await rejectOffer(missionId, editorId)).ok, true);
    assert.equal((await missionRow(missionId)).status, "disponivel");

    const repeated = await rejectOffer(missionId, editorId);
    assert.equal(repeated.ok, false, "recusar duas vezes não pode dar ok");
  });

  test("despacho cria oferta e muda o status da missão juntos", async () => {
    const missionId = await createMission();
    for (const id of editorIds) await markEditorActive(id);

    const dispatched = await dispatchMissions();

    assert.equal(dispatched, 1);
    assert.equal((await missionRow(missionId)).status, "oferecida");

    const offers = await sql`SELECT status FROM ofertas WHERE pauta_id = ${missionId}`;
    assert.equal(offers.length, 1);
    assert.equal(offers[0].status, "pendente");
  });

  test("sem editor elegível a missão continua disponível", async () => {
    const missionId = await createMission();
    await sql`UPDATE users SET ultimo_visto_em = now() - interval '1 hour' WHERE papel = 'editor'`;

    assert.equal(await dispatchMissions(), 0);
    assert.equal((await missionRow(missionId)).status, "disponivel");
    const offers = await sql`SELECT id FROM ofertas WHERE pauta_id = ${missionId}`;
    assert.equal(offers.length, 0);
  });

  test("o banco recusa oferta duplicada para o mesmo par missão/editor", async () => {
    const missionId = await createMission("oferecida");
    const [editorId] = editorIds;
    const insert = () => sql`
      INSERT INTO ofertas (pauta_id, editor_id, expira_em)
      VALUES (${missionId}, ${editorId}, now() + interval '5 minutes')
    `;

    await insert();
    await assert.rejects(insert, (error: { code?: string }) => error.code === "23505");
  });

  test("nenhuma missão fica 'oferecida' sem oferta pendente após despachar", async () => {
    for (let i = 0; i < 5; i++) await createMission();
    for (const id of editorIds) await markEditorActive(id);

    await dispatchMissions();

    const [row] = await sql`
      SELECT count(*)::int AS orfas FROM pautas p
      WHERE p.status = 'oferecida'
        AND NOT EXISTS (
          SELECT 1 FROM ofertas o WHERE o.pauta_id = p.id AND o.status = 'pendente'
        )
    `;
    assert.equal(row.orfas, 0);
  });

  // Em after(): se um assert do before() falhar, o pool ainda fecha e o processo
  // não trava esperando conexão ociosa.
  after(async () => {
    await sql.end();
  });
});
