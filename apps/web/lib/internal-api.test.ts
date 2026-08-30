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
});
