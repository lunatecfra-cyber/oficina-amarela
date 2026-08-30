import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { forwardToApi } from "./internal-api.ts";

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
});
