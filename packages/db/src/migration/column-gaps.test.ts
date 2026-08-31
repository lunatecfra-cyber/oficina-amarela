import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { D1DatabaseLike } from "../d1/types.ts";
import { findColumnGaps, type MigrationTable } from "./pg-to-d1.ts";

/**
 * A origem estar uma migração atrás do destino é o caso normal numa migração
 * de verdade, não a exceção: o dump sai de produção antes de alguém aplicar as
 * migrações novas nele. Antes desta conferência a carga descobria isso no meio
 * do caminho, com o erro cru do PostgreSQL e os gatilhos do destino já
 * desligados — que é o pior momento possível para parar.
 */

/** D1 de mentira: só responde ao PRAGMA com as colunas que mandarem. */
function fakeD1(tables: Record<string, string[]>): D1DatabaseLike {
  return {
    prepare(query: string) {
      const table = /PRAGMA table_info\((\w+)\)/.exec(query)?.[1] ?? "";
      const results = (tables[table] ?? []).map((name) => ({ name }));
      return { all: async () => ({ results }) };
    },
  } as unknown as D1DatabaseLike;
}

/** Origem de mentira: devolve o information_schema que mandarem. */
function fakeSql(tables: Record<string, string[]>) {
  return (async (strings: TemplateStringsArray) => {
    const table = /table_name = '(\w+)'/.exec(String(strings[0]))?.[1] ?? "";
    return (tables[table] ?? []).map((column_name) => ({ column_name }));
  }) as any;
}

const plan: MigrationTable[] = [{ table: "users" }, { table: "pautas" }];

describe("colunas que a origem não tem", () => {
  test("origem em dia não acusa nada", async () => {
    const columns = { users: ["id", "nome", "whatsapp"], pautas: ["id", "titulo"] };
    const gaps = await findColumnGaps(fakeSql(columns), fakeD1(columns), plan);
    assert.deepEqual(gaps, []);
  });

  test("acusa por tabela o que falta, nomeando as colunas", async () => {
    const gaps = await findColumnGaps(
      fakeSql({ users: ["id", "nome"], pautas: ["id", "titulo"] }),
      fakeD1({
        users: ["id", "nome", "whatsapp", "candidate_number"],
        pautas: ["id", "titulo", "candidate_number"],
      }),
      plan,
    );
    assert.deepEqual(gaps, [
      { table: "users", missing: ["whatsapp", "candidate_number"] },
      { table: "pautas", missing: ["candidate_number"] },
    ]);
  });

  // O D1 é um recorte do PostgreSQL: coluna que só existe na origem fica de
  // fora de propósito, e não é lacuna nenhuma.
  test("coluna a mais na origem não é problema", async () => {
    const gaps = await findColumnGaps(
      fakeSql({ users: ["id", "nome", "coluna_que_o_d1_nao_tem"], pautas: ["id"] }),
      fakeD1({ users: ["id", "nome"], pautas: ["id"] }),
      plan,
    );
    assert.deepEqual(gaps, []);
  });

  test("respeita o nome de origem quando a tabela é renomeada no caminho", async () => {
    const gaps = await findColumnGaps(
      fakeSql({ pautas_antigas: ["id", "titulo"] }),
      fakeD1({ pautas: ["id", "titulo"] }),
      [{ table: "pautas", source: "pautas_antigas" }],
    );
    assert.deepEqual(gaps, []);
  });
});
