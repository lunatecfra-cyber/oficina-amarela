import assert from "node:assert/strict";
import { test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import type { Role } from "@oficina/domain/roles";
import { NextRequest } from "next/server.js";
import proxy from "../proxy.ts";

test("dedicated inspector reaches the queue without loops and cannot enter admin or other role areas", async () => {
  process.env.AUTH_SECRET = "isolated-role-proxy-test-secret";
  Object.assign(process.env, { NODE_ENV: "production" });
  for (const role of ["editor", "spokesperson", "inspector", "admin"] as Role[]) {
    const cookie = `${COOKIE_NAME}=${await createSessionToken({ id: 1, handle: "synthetic", name: "Synthetic", role })}`;
    for (const path of [
      "/inspetor",
      "/inspetor/contas",
      "/inspetor/denuncias",
      "/admin",
      "/editor",
      "/porta-voz",
    ]) {
      const response = await proxy(
        new NextRequest(`https://staging.local${path}`, { headers: { cookie } }),
      );
      const allowed =
        role === "admin" ||
        (role === "inspector" && ["/inspetor", "/inspetor/denuncias"].includes(path)) ||
        (role === "editor" && path === "/editor") ||
        (role === "spokesperson" && path === "/porta-voz");
      assert.equal(response.status, allowed ? 200 : 307, `${role}: ${path}`);
      if (!allowed) {
        const destination = new URL(response.headers.get("location")!).pathname;
        assert.notEqual(destination, path);
        const next = await proxy(
          new NextRequest(`https://staging.local${destination}`, { headers: { cookie } }),
        );
        assert.equal(next.status, 200, `${role}: redirect must terminate`);
      }
    }
  }
});
