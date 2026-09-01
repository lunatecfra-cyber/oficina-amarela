import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { sql } from "@oficina/db/client";
import { clearSessionRevocationCache } from "@oficina/db/session-revocation";
import { hashInvitation } from "@oficina/domain/invitations";
import { createApp } from "../app.ts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("administração de convites na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, () => {
  const app = createApp();

  let adminId: number;
  let adminCookie: string;
  let editorCookie: string;
  let spokespersonCookie: string;

  async function cookieFor(id: number, handle: string, role: "editor" | "spokesperson" | "admin") {
    return `${COOKIE_NAME}=${await createSessionToken({ id, handle, name: handle, role })}`;
  }

  async function createUser(handle: string, papel: "voz" | "editor" | "admin") {
    const [user] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel, sessoes_validas_apos)
        VALUES (${handle}, ${handle}, ${`${handle}@teste.local`}, 'x', ${papel}, '1970-01-01 00:00:00+00')
        RETURNING id
      `;
    return Number(user.id);
  }

  const request = (method: string, cookie?: string, body?: Record<string, unknown>) =>
    app.request("http://web.local/admin/invitations", {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  beforeEach(async () => {
    clearSessionRevocationCache();
    await sql`DELETE FROM auditoria_admin`;
    await sql`DELETE FROM convites_porta_voz`;
    await sql`DELETE FROM users WHERE email LIKE '%@teste.local'`;
    adminId = await createUser("inspetor-convites", "admin");
    const editorId = await createUser("editor-convites", "editor");
    const spokespersonId = await createUser("voz-convites", "voz");
    adminCookie = await cookieFor(adminId, "inspetor-convites", "admin");
    editorCookie = await cookieFor(editorId, "editor-convites", "editor");
    spokespersonCookie = await cookieFor(spokespersonId, "voz-convites", "spokesperson");
  });

  after(async () => {
    await sql`DELETE FROM auditoria_admin`;
    await sql`DELETE FROM convites_porta_voz`;
    await sql`DELETE FROM users WHERE email LIKE '%@teste.local'`;
  });

  test("anônimo não lista nem emite", async () => {
    for (const response of [
      await request("GET"),
      await request("POST", undefined, { email: "alvo@exemplo.com" }),
    ]) {
      assert.equal(response.status, 401);
      assert.equal(
        ((await response.json()) as { error: string }).error,
        "Faça login para continuar.",
      );
    }
  });

  test("editor e porta-voz não alcançam a administração de convites", async () => {
    for (const cookie of [editorCookie, spokespersonCookie]) {
      for (const response of [
        await request("GET", cookie),
        await request("POST", cookie, { email: "alvo@exemplo.com" }),
        await request("POST", cookie, { action: "revoke", id: 1 }),
      ]) {
        assert.equal(response.status, 403);
        assert.equal(
          ((await response.json()) as { error: string }).error,
          "Só o inspetor pode fazer isso.",
        );
      }
    }
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM convites_porta_voz`;
    assert.equal(count, 0);
  });

  test("inspetor emite convite: só o hash no banco, link com o token e auditoria", async () => {
    const response = await request("POST", adminCookie, { email: "  Alvo@Exemplo.COM  " });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { token: string; link: string; email: string };
    assert.equal(body.email, "alvo@exemplo.com");
    assert.match(body.link, /^http:\/\/web\.local\/criar-conta\?convite=/);
    assert.ok(body.link.includes(body.token));

    const [invitation] = await sql`
        SELECT email, token_hash, criado_por FROM convites_porta_voz
      `;
    assert.equal(invitation.email, "alvo@exemplo.com");
    assert.equal(invitation.token_hash, await hashInvitation(body.token));
    assert.notEqual(invitation.token_hash, body.token);
    assert.equal(invitation.criado_por, adminId);

    const [audit] = await sql`SELECT ator_id, acao FROM auditoria_admin`;
    assert.deepEqual(audit, { ator_id: adminId, acao: "convite_criado" });
  });

  test("e-mail inválido para na borda antes de gastar convite", async () => {
    const response = await request("POST", adminCookie, { email: "sem-arroba" });
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { error: string }).error, "Digite um e-mail válido.");
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM convites_porta_voz`;
    assert.equal(count, 0);
  });

  test("reemissão para o mesmo e-mail revoga o convite aberto e deixa um só válido", async () => {
    await request("POST", adminCookie, { email: "alvo@exemplo.com" });
    const reissued = await request("POST", adminCookie, { email: "alvo@exemplo.com" });
    assert.equal(reissued.status, 200);

    const listed = (await (await request("GET", adminCookie)).json()) as {
      invitations: Array<{ status: string; email: string }>;
    };
    assert.equal(listed.invitations.length, 2);
    assert.deepEqual(listed.invitations.map((invitation) => invitation.status).sort(), [
      "revogado",
      "valido",
    ]);
  });

  test("duas emissões simultâneas deixam exatamente um convite aberto", async () => {
    // Aquece o pool: sem isso a primeira conexão nasce dentro da corrida.
    await sql`SELECT 1`;
    const [first, second] = await Promise.all([
      request("POST", adminCookie, { email: "corrida@exemplo.com" }),
      request("POST", adminCookie, { email: "corrida@exemplo.com" }),
    ]);
    assert.deepEqual([first.status, second.status].includes(200), true);
    for (const response of [first, second]) {
      assert.ok(
        response.status === 200 || response.status === 409,
        `status inesperado: ${response.status}`,
      );
    }

    const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM convites_porta_voz
        WHERE usado_em IS NULL AND revogado_em IS NULL
      `;
    assert.equal(count, 1);
  });

  test("revogação é do inspetor, acontece uma vez e vira auditoria", async () => {
    const issued = (await (
      await request("POST", adminCookie, { email: "alvo@exemplo.com" })
    ).json()) as { id: number };

    const revoked = await request("POST", adminCookie, { action: "revoke", id: issued.id });
    assert.equal(revoked.status, 200);

    const again = await request("POST", adminCookie, { acao: "revogar", id: issued.id });
    assert.equal(again.status, 409);
    assert.equal(
      ((await again.json()) as { error: string }).error,
      "Convite não está disponível para revogação.",
    );

    const audits = await sql`
        SELECT acao FROM auditoria_admin WHERE acao = 'convite_revogado'
      `;
    assert.equal(audits.length, 1);
  });

  test("convite inválido na revogação para na borda", async () => {
    const response = await request("POST", adminCookie, { action: "revoke", id: "abc" });
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { error: string }).error, "Convite inválido.");
  });
});
