import assert from "node:assert/strict";
import test from "node:test";
import * as admin from "../app/api/admin/lessons/[[...path]]/route.ts";
import * as learner from "../app/api/lessons/[[...path]]/route.ts";

// Next calls a route handler as (request, context). forwardToApi takes a service
// binding as its second argument, so a handler that passes the context straight
// through crashes on every browser call. Without a cookie the API answers 401
// before touching the database, which is enough to prove the request got there.
const context = { params: Promise.resolve({ path: [] }) };

test("lesson route handlers forward the request when called the way Next calls them", async () => {
  const cases: Array<
    [(request: Request, ctx: typeof context) => Promise<Response>, string, string]
  > = [
    [learner.GET, "GET", "/api/lessons"],
    [learner.PUT, "PUT", "/api/lessons/1/progress"],
    [admin.GET, "GET", "/api/admin/lessons"],
    [admin.POST, "POST", "/api/admin/lessons"],
    [admin.PATCH, "PATCH", "/api/admin/lessons/1"],
  ];
  for (const [handler, method, path] of cases) {
    const response = await handler(new Request(`http://web.local${path}`, { method }), context);
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});
