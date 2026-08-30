import assert from "node:assert/strict";
import test, { after, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
delete process.env.DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("configuração do banco por binding", { skip }, async () => {
  const { configureDatabaseUrl, sql } = await import("./client.ts");

  after(async () => {
    await sql.end();
  });

  test("usa a connectionString do Hyperdrive sem DATABASE_URL", async () => {
    configureDatabaseUrl(TEST_DATABASE_URL as string);
    const [row] = await sql`SELECT 1::int AS value`;
    assert.equal(row.value, 1);
  });
});
