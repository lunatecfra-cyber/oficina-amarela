import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("ranking e vagas na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("@oficina/db/client");
  const { COOKIE_NAME, createSessionToken } = await import("@oficina/auth/session");
  const { createApp } = await import("../app.ts");
  const app = createApp();

  const MARK = "%@ranking.local";
  let editorId: number;
  let editorCookie: string;
  let spokespersonCookie: string;

  async function cleanup() {
    await sql`DELETE FROM ranking_aprovacoes WHERE editor_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM bloqueios_constancia WHERE editor_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM ranking_ciclos WHERE nome = 'Ciclo do teste de ranking'`;
    await sql`DELETE FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  before(async () => {
    await cleanup();
    const [editor] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('ed.rank', 'Editor Ranking', 'ed@ranking.local', 'x', 'editor') RETURNING id
      `;
    editorId = Number(editor.id);
    const [voz] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('voz.rank', 'Voz Ranking', 'voz@ranking.local', 'x', 'voz') RETURNING id
      `;
    editorCookie = `${COOKIE_NAME}=${await createSessionToken({ id: editorId, handle: "ed.rank", name: "Editor Ranking", role: "editor" })}`;
    spokespersonCookie = `${COOKIE_NAME}=${await createSessionToken({ id: Number(voz.id), handle: "voz.rank", name: "Voz Ranking", role: "spokesperson" })}`;
  });

  after(async () => {
    await cleanup();
    await sql.end();
  });

  test("vagas são públicas: a página de cadastro precisa delas sem sessão", async () => {
    const response = await app.request("http://api.local/slots");
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      editor: { total: number; free: number; enrolled: number };
      voz: { total: number };
    };
    assert.ok(body.editor.total > 0);
    assert.equal(body.editor.free, Math.max(0, body.editor.total - body.editor.enrolled));
    assert.equal(body.voz.total, body.editor.total > 0 ? body.voz.total : 0);
  });

  test("ranking exige sessão", async () => {
    assert.equal((await app.request("http://api.local/ranking")).status, 401);
    const authenticated = await app.request("http://api.local/ranking", {
      headers: { cookie: editorCookie },
    });
    assert.equal(authenticated.status, 200);
  });

  test("progresso é do editor da sessão e porta-voz não alcança", async () => {
    const denied = await app.request("http://api.local/editor/progress", {
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(denied.status, 403);

    const mine = await app.request("http://api.local/editor/progress", {
      headers: { cookie: editorCookie },
    });
    assert.equal(mine.status, 200);
    const body = (await mine.json()) as { shields: number; weeks: unknown[] };
    assert.equal(body.shields, 0);
    assert.ok(Array.isArray(body.weeks));
  });

  test("aprovações da semana aparecem no progresso e no ranking", async () => {
    const [cycle] = await sql`
        INSERT INTO ranking_ciclos (nome, inicia_em, termina_em)
        VALUES ('Ciclo do teste de ranking', now() - interval '3 days', now() + interval '30 days')
        RETURNING id
      `;
    const [mission] = await sql`
        INSERT INTO pautas (porta_voz_id, titulo, formato, status)
        VALUES ((SELECT id FROM users WHERE email = 'voz@ranking.local'), 'Pauta', 'short', 'aprovada')
        RETURNING id
      `;
    await sql`
        INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_em)
        VALUES (${mission.id}, ${cycle.id}, ${editorId}, now())
      `;

    const progress = (await (
      await app.request("http://api.local/editor/progress", { headers: { cookie: editorCookie } })
    ).json()) as { weeks: Array<{ count: number; goal: number }> };
    const currentWeek = progress.weeks.at(-1);
    assert.equal(currentWeek?.count, 1, "a aprovação de hoje conta na semana corrente");

    const ranking = (await (
      await app.request("http://api.local/ranking", { headers: { cookie: editorCookie } })
    ).json()) as { items: Array<{ id: number; count: number }>; cycle: { name: string } };
    assert.equal(ranking.cycle.name, "Ciclo do teste de ranking");
    assert.deepEqual(
      ranking.items.map((item) => [item.id, item.count]),
      [[editorId, 1]],
    );
  });
});
