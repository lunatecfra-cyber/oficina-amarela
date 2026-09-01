import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { applyAllD1Migrations } from "./schema.ts";
import { createD1SessionRevocationSource } from "./session-revocation.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * A revogação de sessão é o único acesso a dado fora do conjunto de
 * repositórios injetado: ela roda no middleware. Se ela não seguir a escolha de
 * banco, um Worker servido por D1 autentica contra um PostgreSQL que não está
 * lá — e responde 401 em toda requisição autenticada.
 */
describe("paridade D1 da revogação de sessão", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-session-revocation-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let cutoffFor: ReturnType<typeof createD1SessionRevocationSource>;
  let userId: number;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
    cutoffFor = createD1SessionRevocationSource(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM users").run();
    const user = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("revog.d1", "Revogação D1", "revog@d1.local", "editor")
      .first<{ id: number }>();
    userId = Number(user?.id);
  });

  after(() => miniflare.dispose());

  test("conta nova tem corte no passado, então a sessão recém-emitida vale", async () => {
    const cutoff = await cutoffFor(userId);
    assert.ok(cutoff !== null);
    assert.ok(
      (cutoff as number) <= Math.floor(Date.now() / 1000) + 1,
      "o corte de uma conta nova não pode invalidar a sessão que acabou de nascer",
    );
  });

  test("mover o corte para frente revoga a sessão anterior", async () => {
    await db
      .prepare("UPDATE users SET sessions_valid_after = ? WHERE id = ?")
      .bind("2099-01-01T00:00:00.000Z", userId)
      .run();
    const cutoff = await cutoffFor(userId);
    assert.ok((cutoff as number) > Math.floor(Date.now() / 1000));
  });

  test("usuário apagado devolve null — a sessão morre junto", async () => {
    await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    assert.equal(await cutoffFor(userId), null);
  });
});
