// O aviso em massa do painel de panorama.
//
// O contrato entre o botão e a rota tinha derivado sem que nada quebrasse: o
// painel manda `{ type }` e a rota passou a exigir `{ subject, message }`, então
// os dois botões respondiam 400 em todo clique. O teste fixa o formato que o
// painel realmente manda e as duas recusas por falta de gente do outro lado.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { createApp } from "../app.ts";
import { postgresApiDependencies } from "../dependencies.ts";
import { resolveBroadcastAudience } from "./admin-routes.ts";

process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";

type Overview = { inQueue: number; freeEditors: number };

function appWith(overview: Overview, editors: string[] = [], spokespersons: string[] = []) {
  const people = (names: string[]) => names.map((name) => ({ name, email: `${name}@teste.local` }));

  return createApp({
    ...postgresApiDependencies,
    admin: {
      ...postgresApiDependencies.admin,
      getSystemOverview: async () => ({ ...EMPTY_OVERVIEW, ...overview }),
      getActiveEditorEmails: async () => people(editors),
      getActiveSpokespersonEmails: async () => people(spokespersons),
    },
  });
}

const EMPTY_OVERVIEW = {
  inQueue: 0,
  offered: 0,
  inEditing: 0,
  inReview: 0,
  inRevision: 0,
  completed: 0,
  spokespersons: 0,
  editors: 0,
  freeEditors: 0,
  banned: 0,
};

async function adminCookie() {
  const token = await createSessionToken({
    id: 1,
    handle: "inspetor",
    name: "Inspetor",
    role: "admin",
  });
  return `${COOKIE_NAME}=${token}`;
}

const post = (app: ReturnType<typeof createApp>, cookie: string, body: unknown) =>
  app.request("http://api.local/admin/broadcast", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("aviso em massa do painel de panorama", () => {
  test("resolve o público a partir do que o painel manda", () => {
    // Exatamente o corpo montado em apps/web/components/overview-panel.tsx.
    assert.equal(resolveBroadcastAudience({ type: "editors" }), "editors");
    assert.equal(resolveBroadcastAudience({ type: "candidates" }), "spokespersons");
    // Formato antigo, em PT-BR, que ainda pode estar numa aba aberta.
    assert.equal(resolveBroadcastAudience({ tipo: "editores" }), "editors");
    assert.equal(resolveBroadcastAudience({ tipo: "candidatos" }), "spokespersons");
    // O formato que a rota exigia por engano não vale como público.
    assert.equal(resolveBroadcastAudience({ subject: "oi", message: "tudo bem" }), null);
    assert.equal(resolveBroadcastAudience(null), null);
  });

  test("público inválido é recusado", async () => {
    const res = await post(appWith({ inQueue: 3, freeEditors: 3 }), await adminCookie(), {
      subject: "oi",
      message: "tudo bem",
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "Público inválido.");
  });

  test("não avisa editor quando a fila está vazia", async () => {
    const res = await post(appWith({ inQueue: 0, freeEditors: 5 }), await adminCookie(), {
      type: "editors",
    });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /fila/i);
  });

  test("não avisa porta-voz quando nenhum editor está livre", async () => {
    const res = await post(appWith({ inQueue: 5, freeEditors: 0 }), await adminCookie(), {
      type: "candidates",
    });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /editor/i);
  });

  test("com fila cheia e ninguém para avisar, responde sem tocar na caixa de saída", async () => {
    const res = await post(appWith({ inQueue: 4, freeEditors: 0 }), await adminCookie(), {
      type: "editors",
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, sent: 0 });
  });

  test("sem sessão de inspetor não passa", async () => {
    const res = await post(appWith({ inQueue: 4, freeEditors: 4 }), "", { type: "editors" });
    assert.equal(res.status, 401);
  });
});
