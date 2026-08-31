// A ausência de DATABASE_URL não pode virar "banco vazio e saudável".
//
// Cada caso roda em processo separado porque client.ts guarda o cliente em
// globalThis e o aviso em variável de módulo — reimportar no mesmo processo
// devolveria o estado do caso anterior.
//
// Veio de apps/web quando o último acesso direto a banco saiu de lá; a
// propriedade é do pacote de banco, não da aplicação web.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROBE = `
  const { sql } = await import("./src/client.ts");
  try {
    await sql\`SELECT 1\`;
    console.log("STUB");
  } catch (error) {
    console.log(error.message.includes("DATABASE_URL not configured") ? "THROWS" : "OTHER");
  }
`;

type ProbeEnv = { NODE_ENV: "production" | "development" } & Record<string, string>;

async function probe(env: ProbeEnv) {
  const { stdout } = await run(process.execPath, ["--input-type=module", "-e", PROBE], {
    cwd: packageRoot,
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return stdout.trim().split("\n").at(-1);
}

describe("configuração do banco", () => {
  test("produção sem DATABASE_URL falha alto", async () => {
    assert.equal(await probe({ NODE_ENV: "production" }), "THROWS");
  });

  test("DATABASE_STUB não libera stub em produção", async () => {
    assert.equal(await probe({ NODE_ENV: "production", DATABASE_STUB: "1" }), "THROWS");
  });

  test("desenvolvimento sem DATABASE_URL também falha por padrão", async () => {
    assert.equal(await probe({ NODE_ENV: "development" }), "THROWS");
  });

  test("DATABASE_STUB=1 libera stub em desenvolvimento", async () => {
    assert.equal(await probe({ NODE_ENV: "development", DATABASE_STUB: "1" }), "STUB");
  });

  test("build do Next.js segue rodando sem banco", async () => {
    assert.equal(
      await probe({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
      "STUB",
    );
  });
});
