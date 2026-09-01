import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Accounts } from "./accounts.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Busca de conta para o login, no D1.
 *
 * A rota de login chama `findByHandleOrEmail`. Se só o PostgreSQL soubesse
 * procurar pelos dois, quem entrasse pelo e-mail em produção — que roda D1 —
 * receberia "apelido, e-mail ou senha incorretos" com a senha certa, e o
 * PostgreSQL local não mostraria nada de errado.
 */
describe("paridade D1 da busca de conta", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-accounts-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let accounts: ReturnType<typeof createD1Accounts>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
    accounts = createD1Accounts(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM users").run();
    await db
      .prepare(
        "INSERT INTO users (handle, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("bombeiro.rafa", "Bombeiro Rafa", "rafa@oficina.local", "editor", "hash-qualquer")
      .run();
  });

  after(() => miniflare.dispose());

  test("acha pelo apelido e pelo e-mail", async () => {
    for (const identity of ["bombeiro.rafa", "rafa@oficina.local"]) {
      const account = await accounts.findByHandleOrEmail(identity);
      assert.equal(account?.handle, "bombeiro.rafa", identity);
    }
  });

  test("caixa e espaço em volta não atrapalham", async () => {
    for (const identity of ["  Bombeiro.Rafa ", "RAFA@Oficina.Local"]) {
      const account = await accounts.findByHandleOrEmail(identity);
      assert.equal(account?.handle, "bombeiro.rafa", identity);
    }
  });

  test("quem não existe volta nulo, sem inventar conta", async () => {
    assert.equal(await accounts.findByHandleOrEmail("ninguem"), null);
    assert.equal(await accounts.findByHandleOrEmail("ninguem@oficina.local"), null);
  });

  test("devolve o hash para a rota comparar, e o estado de banimento", async () => {
    const account = await accounts.findByHandleOrEmail("rafa@oficina.local");
    assert.equal(account?.passwordHash, "hash-qualquer");
    assert.equal(account?.banned, false);
  });
});
