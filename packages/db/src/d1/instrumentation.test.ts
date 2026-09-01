import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import {
  D1MetricsCollector,
  getActiveD1Metrics,
  instrumentD1Database,
  runWithD1Metrics,
} from "./instrumentation.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("instrumentação do banco D1", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-instrumentation-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );

  after(() => miniflare.dispose());

  test("coleta métricas de consultas, leituras e escritas", async () => {
    const rawDb = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await rawDb
      .prepare("CREATE TABLE IF NOT EXISTS test_items (id INTEGER PRIMARY KEY, name TEXT)")
      .run();
    await rawDb.prepare("DELETE FROM test_items").run();

    const collector = new D1MetricsCollector({ slowQueryThresholdMs: 10 });
    const db = instrumentD1Database(rawDb, { collector });

    // Escrita (run)
    await db.prepare("INSERT INTO test_items (name) VALUES (?)").bind("item 1").run();
    await db.prepare("INSERT INTO test_items (name) VALUES (?)").bind("item 2").run();

    // Leitura única (first)
    const first = await db
      .prepare("SELECT * FROM test_items WHERE id = ?")
      .bind(1)
      .first<{ id: number; name: string }>();
    assert.equal(first?.name, "item 1");

    // Leitura múltipla (all)
    const all = await db
      .prepare("SELECT * FROM test_items ORDER BY id ASC")
      .all<{ id: number; name: string }>();
    assert.equal(all.results.length, 2);

    const summary = collector.getSummary();
    assert.equal(summary.queries, 4);
    assert.ok(summary.durationMs >= 0);
    assert.ok(summary.rowsRead >= 3); // 1 do first + 2 do all
    assert.ok(summary.rowsWritten >= 2); // 2 inserts
  });

  test("funciona com AsyncLocalStorage por contexto de requisição", async () => {
    const rawDb = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const db = instrumentD1Database(rawDb);

    const collectorA = new D1MetricsCollector();
    const collectorB = new D1MetricsCollector();

    await Promise.all([
      runWithD1Metrics(collectorA, async () => {
        assert.equal(getActiveD1Metrics(), collectorA);
        await db.prepare("SELECT 1 as val").all();
        await db.prepare("SELECT 2 as val").all();
      }),
      runWithD1Metrics(collectorB, async () => {
        assert.equal(getActiveD1Metrics(), collectorB);
        await db.prepare("SELECT 3 as val").first();
      }),
    ]);

    assert.equal(collectorA.getSummary().queries, 2);
    assert.equal(collectorB.getSummary().queries, 1);
  });

  test("registra falha em caso de erro SQL sem engolir a exceção", async () => {
    const rawDb = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const collector = new D1MetricsCollector();
    const db = instrumentD1Database(rawDb, { collector });

    await assert.rejects(async () => {
      await db.prepare("SELECT * FROM tabela_que_nao_existe").all();
    });

    const metrics = collector.getMetrics();
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].success, false);
    assert.ok(metrics[0].error);
  });

  test("evita envolver duas vezes o mesmo banco", () => {
    const rawDb = {
      prepare() {
        return {} as never;
      },
    } as unknown as D1DatabaseLike;

    const wrappedOnce = instrumentD1Database(rawDb);
    const wrappedTwice = instrumentD1Database(wrappedOnce);
    assert.equal(wrappedOnce, wrappedTwice);
  });
});
