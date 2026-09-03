import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { createApp } from "./app.ts";
import { postgresApiDependencies } from "./dependencies.ts";

describe("fronteira da API", () => {
  const app = createApp();

  test("/health responde ok", async () => {
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, service: "oficina-amarela-api" });
  });

  test("toda resposta carrega x-request-id", async () => {
    const res = await app.request("/health");
    assert.ok(res.headers.get("x-request-id"));
  });

  test("usa o cf-ray como identificador quando ele vem", async () => {
    const res = await app.request("/health", { headers: { "cf-ray": "abc123-GRU" } });
    assert.equal(res.headers.get("x-request-id"), "abc123-GRU");
  });

  test("aceita a connectionString do binding Hyperdrive", async () => {
    const res = await app.request(
      "/health",
      {},
      { HYPERDRIVE: { connectionString: "postgres://hyperdrive.invalid/oficina" } },
    );
    assert.equal(res.status, 200);
  });

  test("rota desconhecida devolve 404 em PT-BR", async () => {
    const res = await app.request("/nao-existe");
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string; requestId: string };
    assert.equal(body.error, "Rota não encontrada.");
    assert.ok(body.requestId);
  });

  test("erro interno não vaza detalhe", async () => {
    const failing = createApp();
    failing.get("/boom", () => {
      throw new Error("segredo interno");
    });

    const res = await failing.request("/boom");
    assert.equal(res.status, 500);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Algo deu errado por aqui. Tente de novo.");
    assert.doesNotMatch(JSON.stringify(body), /segredo interno/);
  });

  test("total da fila não é capturado pela rota genérica da missão", async () => {
    const app = createApp({
      ...postgresApiDependencies,
      missions: {
        ...postgresApiDependencies.missions,
        getTotalInQueue: async () => 7,
      },
    });

    const res = await app.request("/missions/queue-total");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { total: 7 });
  });
});
