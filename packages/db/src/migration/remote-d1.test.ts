// O adaptador remoto é o único trecho do caminho de migração que nunca rodou
// contra um D1 de verdade. Os testes fixam o que dá para fixar sem rede: como
// os valores viram literal, quando a escrita é descarregada, e que leitura
// enxerga a própria escrita.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRemoteD1, inlineBindings, sqlLiteral } from "./remote-d1.ts";

describe("literais SQL do destino remoto", () => {
  test("escapa aspas simples dobrando", () => {
    assert.equal(sqlLiteral("Editor d'Água"), "'Editor d''Água'");
    assert.equal(sqlLiteral("'; DROP TABLE users; --"), "'''; DROP TABLE users; --'");
  });

  test("números, booleanos e nulo", () => {
    assert.equal(sqlLiteral(42), "42");
    assert.equal(sqlLiteral(-1.5), "-1.5");
    assert.equal(sqlLiteral(true), "1");
    assert.equal(sqlLiteral(false), "0");
    assert.equal(sqlLiteral(null), "NULL");
    assert.equal(sqlLiteral(undefined), "NULL");
  });

  test("recusa número que não vira SQL", () => {
    assert.throws(() => sqlLiteral(Number.NaN), /Número inválido/);
    assert.throws(() => sqlLiteral(Number.POSITIVE_INFINITY), /Número inválido/);
  });
});

describe("substituição de parâmetros", () => {
  test("troca cada ? na ordem", () => {
    assert.equal(
      inlineBindings("INSERT INTO users (nome, idade) VALUES (?, ?)", ["Ana", 30]),
      "INSERT INTO users (nome, idade) VALUES ('Ana', 30)",
    );
  });

  test("não confunde ? dentro de texto", () => {
    assert.equal(
      inlineBindings("INSERT INTO t (a, b) VALUES ('e agora?', ?)", ["sim"]),
      "INSERT INTO t (a, b) VALUES ('e agora?', 'sim')",
    );
  });

  test("recusa contagem errada de valores", () => {
    assert.throws(() => inlineBindings("VALUES (?, ?)", ["um"]), /Faltam valores/);
    assert.throws(() => inlineBindings("VALUES (?)", ["um", "dois"]), /Sobraram 1/);
  });
});

describe("descarga em lote", () => {
  function spy() {
    const calls: string[][] = [];
    return {
      calls,
      runner: async (args: string[]) => {
        calls.push(args);
        return args.includes("--json") ? '[{"results":[{"n":7}]}]' : "";
      },
    };
  }

  test("escrita fica pendente até o limite", async () => {
    const { calls, runner } = spy();
    const db = createRemoteD1("banco", { runner, flushEvery: 3 });

    await db.prepare("INSERT INTO t (a) VALUES (?)").bind(1).run();
    await db.prepare("INSERT INTO t (a) VALUES (?)").bind(2).run();
    assert.equal(db.pendingCount(), 2);
    assert.equal(calls.length, 0, "nada foi enviado ainda");

    await db.prepare("INSERT INTO t (a) VALUES (?)").bind(3).run();
    assert.equal(db.pendingCount(), 0);
    assert.equal(calls.length, 1, "o lote fechou numa única invocação");
    assert.ok(calls[0].includes("--file"));
  });

  test("leitura enxerga a própria escrita", async () => {
    const { calls, runner } = spy();
    const db = createRemoteD1("banco", { runner, flushEvery: 1000 });

    await db.prepare("INSERT INTO t (a) VALUES (?)").bind(1).run();
    assert.equal(db.pendingCount(), 1);

    const row = await db.prepare("SELECT count(*) AS n FROM t").first<{ n: number }>();

    assert.equal(db.pendingCount(), 0, "a leitura descarregou o pendente");
    assert.equal(row?.n, 7);
    assert.ok(calls[0].includes("--file"), "primeiro a escrita");
    assert.ok(calls[1].includes("--command"), "depois a leitura");
  });

  test("flush explícito fecha o que sobrou", async () => {
    const { calls, runner } = spy();
    const db = createRemoteD1("banco", { runner, flushEvery: 1000 });
    await db.prepare("INSERT INTO t (a) VALUES (?)").bind(1).run();
    await db.flush();
    assert.equal(db.pendingCount(), 0);
    assert.equal(calls.length, 1);
  });

  test("apara ';' repetido: instrução vazia derruba o arquivo inteiro", async () => {
    const files: string[] = [];
    const runner = async (args: string[]) => {
      const index = args.indexOf("--file");
      if (index !== -1) {
        const { readFile } = await import("node:fs/promises");
        files.push(await readFile(args[index + 1], "utf8"));
      }
      return "";
    };
    const db = createRemoteD1("banco", { runner, flushEvery: 1000 });

    await db.prepare("CREATE TABLE t (a INTEGER);\n").run();
    await db.prepare("CREATE INDEX i ON t (a);").run();
    await db.flush();

    assert.equal(files.length, 1);
    assert.ok(!/;\s*;/.test(files[0]), `instrução vazia no arquivo:\n${files[0]}`);
  });

  test("flush sem pendência não chama o wrangler", async () => {
    const { calls, runner } = spy();
    const db = createRemoteD1("banco", { runner });
    await db.flush();
    assert.equal(calls.length, 0);
  });
});
