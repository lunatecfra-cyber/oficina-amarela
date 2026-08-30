import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("correções do ranking na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("@oficina/db/client");
  const { COOKIE_NAME, createSessionToken } = await import("@oficina/auth/session");
  const { createApp } = await import("../app.ts");
  const app = createApp();

  let adminId: number;
  let editorId: number;
  let adminCookie: string;
  let editorCookie: string;
  let spokespersonCookie: string;

  async function cookieFor(id: number, handle: string, role: "editor" | "spokesperson" | "admin") {
    return `${COOKIE_NAME}=${await createSessionToken({ id, handle, name: handle, role })}`;
  }

  async function createUser(handle: string, papel: "voz" | "editor" | "admin") {
    const [user] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES (${handle}, ${handle}, ${`${handle}@ranking.local`}, 'x', ${papel})
        RETURNING id
      `;
    return Number(user.id);
  }

  const request = (method: string, cookie?: string, body?: Record<string, unknown>) =>
    app.request("http://web.local/admin/ranking", {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  before(async () => {
    await sql`DELETE FROM users WHERE email LIKE '%@ranking.local'`;
    adminId = await createUser("inspetor-ranking", "admin");
    editorId = await createUser("editor-ranking", "editor");
    const spokespersonId = await createUser("voz-ranking", "voz");
    adminCookie = await cookieFor(adminId, "inspetor-ranking", "admin");
    editorCookie = await cookieFor(editorId, "editor-ranking", "editor");
    spokespersonCookie = await cookieFor(spokespersonId, "voz-ranking", "spokesperson");
  });

  beforeEach(async () => {
    await sql`DELETE FROM bloqueios_constancia WHERE editor_id = ${editorId}`;
    await sql`DELETE FROM auditoria_admin WHERE ator_id = ${adminId}`;
  });

  after(async () => {
    await sql`DELETE FROM bloqueios_constancia WHERE editor_id = ${editorId}`;
    await sql`DELETE FROM auditoria_admin WHERE ator_id = ${adminId}`;
    await sql`DELETE FROM users WHERE email LIKE '%@ranking.local'`;
    await sql.end();
  });

  test("anônimo não lê auditoria nem corrige ranking", async () => {
    assert.equal((await request("GET")).status, 401);
    assert.equal(
      (await request("POST", undefined, { action: "grant_shield", editorId, reason: "x" })).status,
      401,
    );
  });

  test("editor e porta-voz não alcançam as correções do inspetor", async () => {
    for (const cookie of [editorCookie, spokespersonCookie]) {
      for (const response of [
        await request("GET", cookie),
        await request("POST", cookie, { action: "grant_shield", editorId, reason: "tentativa" }),
        await request("POST", cookie, {
          action: "cancel_approval",
          missionId: 1,
          reason: "tentativa",
        }),
      ]) {
        assert.equal(response.status, 403);
        assert.equal(
          ((await response.json()) as { error: string }).error,
          "Só o inspetor pode fazer isso.",
        );
      }
    }
    const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM bloqueios_constancia WHERE editor_id = ${editorId}
      `;
    assert.equal(count, 0);
  });

  test("motivo em branco para na borda, sem gravar bloqueio", async () => {
    const response = await request("POST", adminCookie, {
      action: "grant_shield",
      editorId,
      reason: "   ",
    });
    assert.equal(response.status, 400);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "Informe o motivo do bloqueio.",
    );
    const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM bloqueios_constancia WHERE editor_id = ${editorId}
      `;
    assert.equal(count, 0);
  });

  test("inspetor concede bloqueio, audita e para no máximo de dois", async () => {
    for (const attempt of [1, 2]) {
      const response = await request("POST", adminCookie, {
        action: "grant_shield",
        editorId,
        reason: `correção ${attempt}`,
      });
      assert.equal(response.status, 200);
    }

    const third = await request("POST", adminCookie, {
      acao: "conceder_bloqueio",
      editorId,
      motivo: "terceiro",
    });
    assert.equal(third.status, 409);
    assert.equal(
      ((await third.json()) as { error: string }).error,
      "Editor já possui o máximo de dois bloqueios.",
    );

    const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM bloqueios_constancia WHERE editor_id = ${editorId}
      `;
    assert.equal(count, 2);

    const audits = await sql`
        SELECT acao FROM auditoria_admin
        WHERE ator_id = ${adminId} AND acao = 'bloqueio_concedido'
      `;
    assert.equal(audits.length, 2);
  });

  test("concessões simultâneas não passam do máximo de dois", async () => {
    // Aquece DUAS conexões: com só uma quente, a segunda requisição gasta a
    // abertura da conexão enquanto a primeira já terminou, e a corrida não
    // chega a acontecer — o teste passaria mesmo sem a trava.
    await Promise.all([sql`SELECT pg_sleep(0.1)`, sql`SELECT pg_sleep(0.1)`]);
    await request("POST", adminCookie, {
      action: "grant_shield",
      editorId,
      reason: "primeiro",
    });

    const responses = await Promise.all([
      request("POST", adminCookie, { action: "grant_shield", editorId, reason: "corrida a" }),
      request("POST", adminCookie, { action: "grant_shield", editorId, reason: "corrida b" }),
    ]);
    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 1);

    const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM bloqueios_constancia WHERE editor_id = ${editorId}
      `;
    assert.equal(count, 2);
  });

  test("anular aprovação inexistente devolve conflito em PT-BR", async () => {
    const response = await request("POST", adminCookie, {
      action: "cancel_approval",
      missionId: 987654,
      reason: "engano",
    });
    assert.equal(response.status, 409);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "Esta aprovação não está ativa no ranking.",
    );
  });

  test("inspetor lê a auditoria com o nome do ator", async () => {
    await request("POST", adminCookie, { action: "grant_shield", editorId, reason: "leitura" });
    const audit = (await (await request("GET", adminCookie)).json()) as {
      audit: Array<{ acao: string; ator_nome: string }>;
    };
    assert.equal(audit.audit[0].acao, "bloqueio_concedido");
    assert.equal(audit.audit[0].ator_nome, "inspetor-ranking");
  });

  test("ação desconhecida não vira operação silenciosa", async () => {
    const response = await request("POST", adminCookie, { action: "apagar_tudo" });
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { error: string }).error, "Ação inválida.");
  });
});
