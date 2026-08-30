import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("colaboração da missão na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("@oficina/db/client");
  const { COOKIE_NAME, createSessionToken } = await import("@oficina/auth/session");
  const { createApp } = await import("../app.ts");
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
    await sql`TRUNCATE denuncias, mensagens, ofertas, pautas, users RESTART IDENTITY CASCADE`;
    const users = await sql`
        INSERT INTO users (apelido, nome, email, papel)
        VALUES
          ('voz.chat', 'Voz Chat', 'voz.chat@teste.local', 'voz'),
          ('editor.chat', 'Editor Chat', 'editor.chat@teste.local', 'editor'),
          ('fora.chat', 'Fora Chat', 'fora.chat@teste.local', 'editor')
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
    await sql.end();
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
