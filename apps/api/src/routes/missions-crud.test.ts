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

describe("operações e consultas de missões na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, () => {
  const app = createApp();

  const MARK = "%@missionscrud.local";
  let spokespersonId: number;
  let spokespersonCookie: string;
  let _adminCookie: string;

  async function cleanup() {
    await sql`DELETE FROM ofertas WHERE pauta_id IN (
        SELECT id FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK}))`;
    await sql`DELETE FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  beforeEach(async () => {
    clearSessionRevocationCache();
    await cleanup();
    const [sp] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel, perfil_completo)
      VALUES ('voz.crud', 'Voz Crud', 'voz@missionscrud.local', 'x', 'voz', true)
      RETURNING id
    `;
    spokespersonId = Number(sp.id);

    const [adm] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('adm.crud', 'Adm Crud', 'adm@missionscrud.local', 'x', 'admin')
      RETURNING id
    `;

    spokespersonCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: spokespersonId,
      handle: "voz.crud",
      name: "Voz Crud",
      role: "spokesperson",
    })}`;

    _adminCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: Number(adm.id),
      handle: "adm.crud",
      name: "Adm Crud",
      role: "admin",
    })}`;
  });

  after(cleanup);

  test("criação, listagem e exclusão de missões", async () => {
    const resCreate = await app.request("/missions", {
      method: "POST",
      headers: {
        cookie: spokespersonCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Missão Integração",
        format: "short",
        briefField: "tom",
      }),
    });
    assert.equal(resCreate.status, 201);
    const bodyCreate = (await resCreate.json()) as { ok: boolean; id: number };
    assert.equal(bodyCreate.ok, true);
    const missionId = bodyCreate.id;

    const resListSp = await app.request("/missions/spokesperson", {
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(resListSp.status, 200);
    const listSp = (await resListSp.json()) as { id: string | number; title: string }[];
    assert.ok(listSp.some((m) => String(m.id).endsWith(String(missionId))));

    const resQueueTotal = await app.request("/missions/queue-total", {
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(resQueueTotal.status, 200);
    const queueTotal = (await resQueueTotal.json()) as { total: number };
    assert.ok(queueTotal.total >= 1);

    const resDel = await app.request(`/missions/${missionId}`, {
      method: "DELETE",
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(resDel.status, 200);
  });
});
