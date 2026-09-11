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

  test("alerts: stalled queue mission and open report appear, resolved report disappears", async () => {
    const [voz] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('voz.routes', 'Voz Routes', 'voz@adminroutes.local', 'x', 'voz')
      RETURNING id
    `;
    const [pauta] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, status, criada_em)
      VALUES (${Number(voz.id)}, 'Corte parado', 'short', 'disponivel', now() - interval '4 days')
      RETURNING id
    `;
    const [denuncia] = await sql`
      INSERT INTO denuncias (pauta_id, denunciante_id, texto, status)
      VALUES (${Number(pauta.id)}, ${targetUserId}, 'algo errado', 'aberta')
      RETURNING id
    `;

    const res = await app.request("/admin/notifications", { headers: { cookie: adminCookie } });
    assert.equal(res.status, 200);
    const notifications = (await res.json()) as { id: string; category: string; href: string }[];

    const queueAlert = notifications.find((n) => n.id === `queue_stalled:${pauta.id}`);
    assert.ok(queueAlert, "expected a queue-stalled alert");
    assert.equal(queueAlert?.href, "/inspetor/panorama");

    const reportAlert = notifications.find((n) => n.id === `report_open:${denuncia.id}`);
    assert.ok(reportAlert, "expected an open-report alert");
    assert.equal(reportAlert?.href, "/inspetor/denuncias");

    await sql`UPDATE denuncias SET status = 'resolvida' WHERE id = ${Number(denuncia.id)}`;
    const resAfter = await app.request("/admin/notifications", {
      headers: { cookie: adminCookie },
    });
    const notificationsAfter = (await resAfter.json()) as { id: string }[];
    assert.ok(!notificationsAfter.some((n) => n.id === `report_open:${denuncia.id}`));
  });
});
