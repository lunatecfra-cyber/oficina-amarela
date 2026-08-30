import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("password login accepts either handle or email", () => {
  const accounts = readFileSync(new URL("./accounts.ts", import.meta.url), "utf8");

  assert.match(accounts, /WHERE lower\(handle\) = lower\(/i);
  assert.match(accounts, /OR lower\(email\) = lower\(/i);
});
