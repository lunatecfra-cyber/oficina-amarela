import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { sql } from "@oficina/db/client";
import { clearSessionRevocationCache } from "@oficina/db/session-revocation";
import { createApp } from "../app.ts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("rotas de administração e fiscalização na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, () => {
  const app = createApp();

  const MARK = "%@adminroutes.local";
  let adminId: number;
  let targetUserId: number;
  let adminCookie: string;

  async function cleanup() {
    await sql`DELETE FROM denuncias WHERE pauta_id IN (
        SELECT id FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK}))`;
    await sql`DELETE FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  beforeEach(async () => {
    clearSessionRevocationCache();
    await cleanup();
    const [adm] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('adm.routes', 'Adm Routes', 'adm@adminroutes.local', 'x', 'admin')
      RETURNING id
    `;
    adminId = Number(adm.id);

    const [u] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('target.user', 'Target User', 'target@adminroutes.local', 'x', 'editor')
      RETURNING id
    `;
    targetUserId = Number(u.id);

    adminCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: adminId,
      handle: "adm.routes",
      name: "Adm Routes",
      role: "admin",
    })}`;
  });

  after(cleanup);

  test("busca de contas, visão geral e banimento", async () => {
    const resSearch = await app.request("/admin/users?q=target", {
      headers: { cookie: adminCookie },
    });
    assert.equal(resSearch.status, 200);
    const users = (await resSearch.json()) as { users: { handle: string }[] };
    assert.ok(users.users.some((u) => u.handle === "target.user"));

    const resOverview = await app.request("/admin/overview", {
      headers: { cookie: adminCookie },
    });
    assert.equal(resOverview.status, 200);

    const resBan = await app.request(`/admin/users/${targetUserId}/ban`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "Violação de termos" }),
    });
    assert.equal(resBan.status, 200);

    const resUnban = await app.request(`/admin/users/${targetUserId}/unban`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    assert.equal(resUnban.status, 200);
  });
});
