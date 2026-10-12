import assert from "node:assert/strict";
import { test } from "node:test";
import { setApiBinding } from "./internal-api.ts";
import { getEditingQueue } from "./overview-db.ts";

test("panorama extrai a lista de missões do envelope da API", async () => {
  const queue = [{ id: 38, title: "Missão sintética" }];
  setApiBinding({ fetch: () => Response.json({ queue, fila: queue, items: queue }) });
  try {
    assert.deepEqual(await getEditingQueue(), queue);
  } finally {
    setApiBinding(null);
  }
});
