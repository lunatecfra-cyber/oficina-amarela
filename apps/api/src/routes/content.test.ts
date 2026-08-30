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

describe("rotas de novidades e músicas na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, () => {
  const app = createApp();

  const MARK = "%@contentroutes.local";
  let adminId: number;
  let adminCookie: string;

  async function cleanup() {
    await sql`DELETE FROM musicas WHERE adicionado_por IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM novidades WHERE autor_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  beforeEach(async () => {
    clearSessionRevocationCache();
    await cleanup();
    const [adm] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('adm.content', 'Adm Content', 'adm@contentroutes.local', 'x', 'admin')
      RETURNING id
    `;
    adminId = Number(adm.id);

    adminCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: adminId,
      handle: "adm.content",
      name: "Adm Content",
      role: "admin",
    })}`;
  });

  after(cleanup);

  test("criação e listagem de novidades e músicas", async () => {
    const resCreateNews = await app.request("/admin/news", {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Atualização da Plataforma",
        text: "Novos recursos lançados hoje.",
        isPublished: true,
      }),
    });
    assert.equal(resCreateNews.status, 201);
    const bodyNews = (await resCreateNews.json()) as { ok: boolean; id: number };
    assert.equal(bodyNews.ok, true);

    const resPublicNews = await app.request("/news");
    assert.equal(resPublicNews.status, 200);
    const publicNews = (await resPublicNews.json()) as { id: number; title: string }[];
    assert.ok(publicNews.some((n) => n.id === bodyNews.id));

    const resAddMusic = await app.request("/tools/music", {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Trilha Épica de Abertura",
        tags: ["abertura", "orquestra"],
        url: "https://r2.oficinaamarela.com/epica.mp3",
        size: 5000000,
      }),
    });
    assert.equal(resAddMusic.status, 201);

    const resListMusic = await app.request("/tools/music?tag=abertura", {
      headers: { cookie: adminCookie },
    });
    assert.equal(resListMusic.status, 200);
    const listMusic = (await resListMusic.json()) as { name: string }[];
    assert.ok(listMusic.some((m) => m.name === "Trilha Épica de Abertura"));
  });
});
