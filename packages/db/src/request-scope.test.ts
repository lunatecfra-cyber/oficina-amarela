import assert from "node:assert/strict";
import { describe, test } from "node:test";

/**
 * O cliente PostgreSQL precisa ter escopo de requisição nos Workers.
 *
 * No workerd um socket aberto durante uma requisição não pode ser usado na
 * seguinte — o runtime responde "Cannot perform I/O on behalf of a different
 * request". Guardar o cliente numa global, que é o certo no Node, fazia a
 * primeira requisição do isolate funcionar e todas as outras devolverem 500.
 * Isso foi observado rodando o Worker de verdade, não em teoria.
 *
 * Estes testes travam o contrato do escopo. O que eles não conseguem provar é o
 * comportamento do workerd; para isso vale o Worker rodando:
 *
 *   cd apps/api && npx wrangler dev --local     # com .dev.vars
 *   # seis GET seguidos em /admin/invitations precisam devolver 200
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

describe("escopo de banco por requisição", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql, withRequestDatabase } = await import("./client.ts");

  test("cada escopo usa uma conexão própria", async () => {
    const [first] = (await withRequestDatabase(
      () => sql`SELECT pg_backend_pid() AS pid` as unknown as Promise<{ pid: number }[]>,
    )) as { pid: number }[];
    const [second] = (await withRequestDatabase(
      () => sql`SELECT pg_backend_pid() AS pid` as unknown as Promise<{ pid: number }[]>,
    )) as { pid: number }[];

    assert.ok(first.pid, "o escopo precisa responder consulta");
    assert.ok(second.pid);
    assert.notEqual(
      first.pid,
      second.pid,
      "dois escopos reaproveitaram a mesma conexão — no workerd isso vira erro de I/O",
    );
  });

  test("escopos aninhados não vazam a conexão de fora", async () => {
    const pids = await withRequestDatabase(async () => {
      const [outer] = (await sql`SELECT pg_backend_pid() AS pid`) as unknown as {
        pid: number;
      }[];
      const [inner] = (await withRequestDatabase(
        () => sql`SELECT pg_backend_pid() AS pid` as unknown as Promise<{ pid: number }[]>,
      )) as { pid: number }[];
      return { outer: outer.pid, inner: inner.pid };
    });
    assert.notEqual(pids.outer, pids.inner);
  });

  test("fora de escopo o cliente global continua atendendo", async () => {
    const [row] = (await sql`SELECT 1 AS ok`) as unknown as { ok: number }[];
    assert.equal(Number(row.ok), 1);
    await sql.end();
  });
});
