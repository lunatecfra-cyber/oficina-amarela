import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { apiTransport, forwardToApi, setApiBinding } from "./internal-api.ts";

describe("adaptador do Service Binding", () => {
  test("encaminha pelo fetch do binding sem salto público", async () => {
    let received: Request | undefined;
    const response = await forwardToApi(
      new Request("https://web.local/api/missions/db-7?after=cursor", {
        method: "POST",
        headers: { cookie: "sessao=valor", "content-type": "application/json" },
        body: JSON.stringify({ action: "message", text: "oi" }),
      }),
      {
        fetch(request) {
          received = request;
          return Response.json({ ok: true });
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(new URL(received?.url ?? "").pathname, "/missions/db-7");
    assert.equal(new URL(received?.url ?? "").search, "?after=cursor");
    assert.equal(received?.headers.get("cookie"), "sessao=valor");
    assert.deepEqual(await received?.json(), { action: "message", text: "oi" });
  });

  test("sem binding registrado, atende em processo", () => {
    setApiBinding(null);
    assert.equal(apiTransport(), "in-process");
  });

  test("binding registrado passa a atender, e desregistrar volta ao processo", async () => {
    const seen: string[] = [];
    setApiBinding({
      fetch(request) {
        seen.push(new URL(request.url).pathname);
        return Response.json({ via: "binding" });
      },
    });
    assert.equal(apiTransport(), "service-binding");

    const response = await forwardToApi(new Request("https://web.local/api/health"));
    assert.deepEqual(await response.json(), { via: "binding" });
    assert.deepEqual(seen, ["/health"]);

    setApiBinding(undefined);
    assert.equal(apiTransport(), "in-process");
  });

  // Os dois erros abaixo só apareceram com os dois Workers rodando de verdade:
  // no dry-run e no teste em processo nada é imutável, e ambos passavam.
  test("cabeçalhos da requisição vão mutáveis para o binding", async () => {
    // Uma requisição que chegou a um Worker tem cabeçalhos imutáveis.
    const incoming = new Request("https://web.local/api/health", {
      headers: { cookie: "sessao=valor" },
    });
    Object.defineProperty(incoming.headers, "set", {
      value: () => {
        throw new TypeError("Can't modify immutable headers.");
      },
    });

    let received: Request | undefined;
    await forwardToApi(incoming, {
      fetch(request) {
        received = request;
        return new Response("ok");
      },
    });

    assert.doesNotThrow(
      () => received?.headers.set("x-teste", "1"),
      "o binding precisa receber cabeçalhos que ele possa ajustar",
    );
    assert.equal(received?.headers.get("cookie"), "sessao=valor");
  });

  test("cabeçalhos da resposta voltam mutáveis para o Next", async () => {
    const immutable = new Response("ok", { headers: { "content-type": "text/plain" } });
    Object.defineProperty(immutable.headers, "set", {
      value: () => {
        throw new TypeError("Can't modify immutable headers.");
      },
    });

    const response = await forwardToApi(new Request("https://web.local/api/health"), {
      fetch: () => immutable,
    });

    assert.doesNotThrow(
      () => response.headers.set("x-teste", "1"),
      "o Next ajusta cabeçalhos antes de entregar; a resposta precisa aceitar",
    );
    assert.equal(response.headers.get("content-type"), "text/plain");
  });
});
