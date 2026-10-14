import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { NextRequest } from "next/server.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});
const { default: proxy } = await import("../proxy.ts");

test("inspetor entra na inspeção e sai da área de editor sem ciclo", async () => {
  process.env.AUTH_SECRET = "proxy-test-secret";
  const token = await createSessionToken({
    id: 1,
    name: "Inspector",
    handle: "inspector",
    role: "inspector",
  });
  for (const [path, destination] of [
    ["/inspetor", null],
    ["/editor", "/inspetor"],
  ] as const) {
    const response = await proxy(
      new NextRequest(`https://example.test${path}`, {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      }),
    );
    assert.equal(
      response.headers.get("location"),
      destination ? `https://example.test${destination}` : null,
    );
  }
});
