// A fila do editor pela borda HTTP do Hono: autenticação, papel, e os mesmos
// motivos tipados do repositório traduzidos para PT-BR.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { sql } from "@oficina/db/client";
import { postgresMissionQueue as queue } from "@oficina/db/mission-queue";
import { clearSessionRevocationCache } from "@oficina/db/session-revocation";
import { createApp } from "../app.ts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("fila do editor na API", { skip }, () => {
  const app = createApp();

  let editorId: number;
  let spokespersonId: number;
  let editorCookie: string;
  let spokespersonCookie: string;

  const call = (path: string, init: RequestInit = {}) =>
    app.request(`http://api.local${path}`, init);

  const errorOf = async (response: Response) =>
    ((await response.json()) as { error: string }).error;

  async function cookieFor(id: number, handle: string, role: "editor" | "spokesperson") {
    const token = await createSessionToken({ id, handle, name: handle, role });
    return `${COOKIE_NAME}=${token}`;
  }

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    clearSessionRevocationCache();
    await sql`TRUNCATE ofertas, pautas, users RESTART IDENTITY CASCADE`;
    // A varredura do GET é reivindicada uma vez a cada 5s globalmente. Sem
    // limpar a trava, o segundo teste do arquivo cairia na janela do primeiro
    // e não despacharia nada.
    await sql`DELETE FROM tarefas_periodicas`;

    const [voz] = await sql`
      INSERT INTO users (apelido, nome, email, papel, sessoes_validas_apos)
      VALUES ('voz.api', 'Voz API', 'voz.api@teste.local', 'voz', '1970-01-01 00:00:00+00') RETURNING id
    `;
    spokespersonId = voz.id;

    const [editor] = await sql`
      INSERT INTO users (apelido, nome, email, papel, ultimo_visto_em, sessoes_validas_apos)
      VALUES ('editor.api', 'Editor API', 'editor.api@teste.local', 'editor', now(), '1970-01-01 00:00:00+00')
      RETURNING id
    `;
    editorId = editor.id;

    editorCookie = await cookieFor(editorId, "editor.api", "editor");
    spokespersonCookie = await cookieFor(spokespersonId, "voz.api", "spokesperson");
  });

  after(async () => {
    await sql`TRUNCATE ofertas, pautas, users RESTART IDENTITY CASCADE`;
  });

  async function createMission() {
    const [row] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, status)
      VALUES (${spokespersonId}, 'Missão da API', 'short', 'disponivel')
      RETURNING id
    `;
    return row.id as number;
  }

  test("sem cookie devolve 401 em PT-BR", async () => {
    const res = await call("/editor/queue/next");
    assert.equal(res.status, 401);
    assert.equal(await errorOf(res), "Faça login para continuar.");
  });

  test("porta-voz não recebe missão", async () => {
    const res = await call("/editor/queue/next", { headers: { cookie: spokespersonCookie } });
    assert.equal(res.status, 403);
    assert.equal(await errorOf(res), "Só editores recebem missões.");
  });

  test("sem oferta pendente responde 204", async () => {
    const res = await call("/editor/queue/next", { headers: { cookie: editorCookie } });
    assert.equal(res.status, 204);
  });

  test("a varredura do GET despacha e devolve a oferta", async () => {
    const missionId = await createMission();

    const res = await call("/editor/queue/next", { headers: { cookie: editorCookie } });

    assert.equal(res.status, 200);
    const offer = (await res.json()) as { mission: { id: string }; expiresAt: string };
    assert.equal(offer.mission.id, `db-${missionId}`);
    assert.ok(offer.expiresAt);
  });

  test("aceitar entrega a missão ao editor", async () => {
    const missionId = await createMission();
    await queue.dispatchOffers();

    const res = await call("/editor/queue/next", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({ missionId, action: "accept" }),
    });

    assert.equal(res.status, 200);
    const [row] = await sql`SELECT status, reservada_por_id FROM pautas WHERE id = ${missionId}`;
    assert.equal(row.status, "reservada");
    assert.equal(row.reservada_por_id, editorId);
  });

  test("aceitar oferta que não existe mais responde 409 em PT-BR", async () => {
    const missionId = await createMission();

    const res = await call("/editor/queue/next", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({ missionId, action: "accept" }),
    });

    assert.equal(res.status, 409);
    assert.equal(await errorOf(res), "Essa oferta não é mais válida.");
  });

  test("recusar devolve a missão para a fila", async () => {
    const missionId = await createMission();
    await queue.dispatchOffers();

    const res = await call("/editor/queue/next", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({ missionId, action: "decline" }),
    });

    assert.equal(res.status, 200);
    const [offer] = await sql`SELECT status FROM ofertas WHERE pauta_id = ${missionId}`;
    assert.equal(offer.status, "rejeitada");
  });

  test("ação desconhecida responde 400", async () => {
    const res = await call("/editor/queue/next", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({ missionId: 1, action: "voar" }),
    });
    assert.equal(res.status, 400);
    assert.equal(await errorOf(res), "Ação desconhecida para a fila.");
  });

  test("identificador de missão inválido responde 400", async () => {
    const res = await call("/editor/queue/next", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({ missionId: "abc", action: "accept" }),
    });
    assert.equal(res.status, 400);
    assert.equal(await errorOf(res), "Missão inválida.");
  });
});
