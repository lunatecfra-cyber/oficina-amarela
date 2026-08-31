import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { sql } from "@oficina/db/client";
import { clearSessionRevocationCache } from "@oficina/db/session-revocation";
import { createApp } from "../app.ts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("colaboração da missão na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, () => {
  const app = createApp();
  let missionId: number;
  let spokespersonId: number;
  let editorId: number;
  let outsiderId: number;
  let spokespersonCookie: string;
  let editorCookie: string;
  let outsiderCookie: string;

  async function cookieFor(id: number, handle: string, role: "editor" | "spokesperson" | "admin") {
    return `${COOKIE_NAME}=${await createSessionToken({ id, handle, name: handle, role })}`;
  }

  const request = (method: string, cookie?: string, body?: Record<string, unknown>, query = "") =>
    app.request(`http://api.local/missions/db-${missionId}${query}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    clearSessionRevocationCache();
    await sql`TRUNCATE denuncias, mensagens, ofertas, pautas, users RESTART IDENTITY CASCADE`;
    const users = await sql`
        INSERT INTO users (apelido, nome, email, papel, sessoes_validas_apos)
        VALUES
          ('voz.chat', 'Voz Chat', 'voz.chat@teste.local', 'voz', '1970-01-01 00:00:00+00'),
          ('editor.chat', 'Editor Chat', 'editor.chat@teste.local', 'editor', '1970-01-01 00:00:00+00'),
          ('fora.chat', 'Fora Chat', 'fora.chat@teste.local', 'editor', '1970-01-01 00:00:00+00')
        RETURNING id
      `;
    [spokespersonId, editorId, outsiderId] = users.map((user) => user.id as number);
    const [mission] = await sql`
        INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id)
        VALUES (${spokespersonId}, 'Missão colaborativa', 'short', 'reservada', ${editorId})
        RETURNING id
      `;
    missionId = mission.id as number;
    spokespersonCookie = await cookieFor(spokespersonId, "voz.chat", "spokesperson");
    editorCookie = await cookieFor(editorId, "editor.chat", "editor");
    outsiderCookie = await cookieFor(outsiderId, "fora.chat", "editor");
  });

  after(async () => {
    await sql`TRUNCATE denuncias, mensagens, ofertas, pautas, users RESTART IDENTITY CASCADE`;
  });

  test("leitura em lote é só do inspetor e agrupa por missão", async () => {
    await sql`
      INSERT INTO mensagens (pauta_id, autor_id, texto)
      VALUES (${missionId}, ${editorId}, 'primeira'), (${missionId}, ${spokespersonId}, 'segunda')
    `;
    const adminCookie = await cookieFor(spokespersonId, "voz.chat", "admin");
    const batch = (cookie?: string, query = `?ids=${missionId}`) =>
      app.request(`http://api.local/missions/messages${query}`, {
        headers: cookie ? { cookie } : {},
      });

    assert.equal((await batch()).status, 401);
    assert.equal((await batch(editorCookie)).status, 403, "editor não lê em lote");

    const response = await batch(adminCookie);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { messages: Record<string, { text: string }[]> };
    assert.equal(body.messages[String(missionId)].length, 2);

    const empty = await batch(adminCookie, "?ids=");
    assert.equal(empty.status, 200);
    assert.deepEqual(((await empty.json()) as { messages: unknown }).messages, {});

    const invalid = await batch(adminCookie, "?ids=abc");
    assert.equal(invalid.status, 400);
  });

  test("exige sessão em PT-BR", async () => {
    const response = await request("GET");
    assert.equal(response.status, 401);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "Faça login para continuar.",
    );
  });

  test("nega leitura, mensagem e denúncia de quem não participa", async () => {
    assert.equal((await request("GET", outsiderCookie)).status, 403);
    assert.equal(
      (await request("POST", outsiderCookie, { action: "message", text: "intrusão" })).status,
      403,
    );
    assert.equal(
      (await request("POST", outsiderCookie, { action: "report", text: "intrusão" })).status,
      403,
    );
  });

  test("participantes trocam mensagens e cursor retorna apenas as novas", async () => {
    const sent = await request("POST", editorCookie, { acao: "mensagem", texto: "  Olá!  " });
    assert.equal(sent.status, 200);
    const sentBody = (await sent.json()) as { message: { text: string; createdAt: string } };
    assert.equal(sentBody.message.text, "Olá!");

    const all = (await (await request("GET", spokespersonCookie)).json()) as {
      messages: Array<{ text: string }>;
    };
    assert.deepEqual(
      all.messages.map((message) => message.text),
      ["Olá!"],
    );

    const afterCursor = encodeURIComponent(new Date(sentBody.message.createdAt).toISOString());
    const after = (await (
      await request("GET", spokespersonCookie, undefined, `?after=${afterCursor}`)
    ).json()) as { messages: unknown[] };
    assert.deepEqual(after.messages, []);
  });

  test("denúncia identifica a contraparte e conteúdo vazio falha na borda", async () => {
    assert.equal(
      (await request("POST", spokespersonCookie, { action: "report", text: "  Áudio ofensivo  " }))
        .status,
      200,
    );
    const [report] = await sql`
        SELECT denunciante_id, denunciado_id, texto FROM denuncias WHERE pauta_id = ${missionId}
      `;
    assert.deepEqual(report, {
      denunciante_id: spokespersonId,
      denunciado_id: editorId,
      texto: "Áudio ofensivo",
    });

    const empty = await request("POST", editorCookie, { action: "message", text: "  " });
    assert.equal(empty.status, 400);
    assert.equal(
      ((await empty.json()) as { error: string }).error,
      "A mensagem não pode ficar em branco.",
    );
  });
});
