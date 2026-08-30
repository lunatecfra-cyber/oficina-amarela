import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("backend notifications only emit existing PT-BR public routes", () => {
  const notifications = [
    source("app/api/missions/[id]/route.ts"),
    source("app/api/editor/queue/next/route.ts"),
    source("app/api/admin/broadcast/route.ts"),
  ].join("\n");

  assert.doesNotMatch(notifications, /\/spokesperson(?:\/|\b)/);
  assert.match(notifications, /\/porta-voz\/missao\/db-/);
  assert.match(notifications, /\/porta-voz\/nova-pauta/);
});
