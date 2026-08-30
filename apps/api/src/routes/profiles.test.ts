import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("perfis e onboarding na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("@oficina/db/client");
  const { clearSessionRevocationCache } = await import("@oficina/db/session-revocation");
  const { COOKIE_NAME, createSessionToken } = await import("@oficina/auth/session");
  const { createApp } = await import("../app.ts");
  const app = createApp();

  const MARK = "%@profiles.local";
  let editorId: number;
  let spokespersonId: number;
  let editorCookie: string;
  let spokespersonCookie: string;

  async function cleanup() {
    await sql`DELETE FROM portfolio WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM conquistas WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK}) OR reservada_por_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  beforeEach(async () => {
    clearSessionRevocationCache();
    await cleanup();
    const [editor] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('ed.prof', 'Editor Perfil', 'ed@profiles.local', 'x', 'editor') RETURNING id
      `;
    editorId = Number(editor.id);

    const [voz] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('voz.prof', 'Voz Perfil', 'voz@profiles.local', 'x', 'voz') RETURNING id
      `;
    spokespersonId = Number(voz.id);

    editorCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: editorId,
      handle: "ed.prof",
      name: "Editor Perfil",
      role: "editor",
    })}`;

    spokespersonCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: spokespersonId,
      handle: "voz.prof",
      name: "Voz Perfil",
      role: "spokesperson",
    })}`;
  });

  after(async () => {
    await cleanup();
  });

  test("perfil editável exige sessão", async () => {
    assert.equal((await app.request("http://api.local/profile")).status, 401);

    const getRes = await app.request("http://api.local/profile", {
      headers: { cookie: editorCookie },
    });
    assert.equal(getRes.status, 200);

    const postRes = await app.request("http://api.local/profile", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({
        headline: ["Edição dinâmica"],
        bio: "Minha bio de editor",
        location: "Curitiba, PR",
      }),
    });
    assert.equal(postRes.status, 200);

    const checkRes = await app.request("http://api.local/profile", {
      headers: { cookie: editorCookie },
    });
    const data = (await checkRes.json()) as { headline: string[]; bio: string; location: string };
    assert.deepEqual(data.headline, ["Edição dinâmica"]);
    assert.equal(data.bio, "Minha bio de editor");
    assert.equal(data.location, "Curitiba, PR");
  });

  test("onboarding de editor exige papel de editor", async () => {
    const denied = await app.request("http://api.local/editor/profile", {
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(denied.status, 403);

    const allowed = await app.request("http://api.local/editor/profile", {
      headers: { cookie: editorCookie },
    });
    assert.equal(allowed.status, 200);

    const saveRes = await app.request("http://api.local/editor/profile", {
      method: "POST",
      headers: { cookie: editorCookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Editor Perfil Atualizado",
        location: "Curitiba, PR",
        softwares: ["Premiere", "After Effects"],
        styles: ["Reels dinâmico"],
        editingLevel: "Avançado",
        pcSetup: "🚀 PC Monstro",
      }),
    });
    assert.equal(saveRes.status, 200);
  });

  test("onboarding de porta-voz e consulta de candidato", async () => {
    const denied = await app.request("http://api.local/spokesperson/profile", {
      headers: { cookie: editorCookie },
    });
    assert.equal(denied.status, 403);

    const saveRes = await app.request("http://api.local/spokesperson/profile", {
      method: "POST",
      headers: { cookie: spokespersonCookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Voz Perfil Oficial",
        politicalOffice: "Vereador",
        runningFor: "Curitiba, PR",
        location: "Curitiba, PR",
        campaignFlags: ["Saúde", "Educação"],
        communicationTone: "Direto e firme",
      }),
    });
    assert.equal(saveRes.status, 200);

    const ownRes = await app.request("http://api.local/spokesperson/own", {
      headers: { cookie: spokespersonCookie },
    });
    assert.equal(ownRes.status, 200);
    const ownData = (await ownRes.json()) as { slug: string; name: string };
    assert.equal(ownData.slug, "voz.prof");
    assert.equal(ownData.name, "Voz Perfil Oficial");

    const pubRes = await app.request("http://api.local/candidates/voz.prof");
    assert.equal(pubRes.status, 200);

    const byHandlesRes = await app.request("http://api.local/candidates/by-handles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handles: ["voz.prof"] }),
    });
    assert.equal(byHandlesRes.status, 200);
    const map = (await byHandlesRes.json()) as Record<string, { name: string }>;
    assert.equal(map["voz.prof"]?.name, "Voz Perfil Oficial");
  });

  test("desafios diários e login diário", async () => {
    const loginRes = await app.request("http://api.local/editor/daily-login", {
      method: "POST",
      headers: { cookie: editorCookie },
    });
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as { recorded: boolean; xp: number };
    assert.equal(loginData.recorded, true);
    assert.equal(loginData.xp, 10);

    const challengesRes = await app.request("http://api.local/editor/challenges", {
      headers: { cookie: editorCookie },
    });
    assert.equal(challengesRes.status, 200);
    const list = (await challengesRes.json()) as Array<{ id: string; completed: boolean }>;
    const loginChallenge = list.find((c) => c.id === "entrada_diaria");
    assert.equal(loginChallenge?.completed, true);
  });
});
