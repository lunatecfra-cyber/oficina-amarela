import assert from "node:assert/strict";
import test from "node:test";
import { partnersHeader, partnersReturnPath } from "./navigation.ts";

test("partners keeps the correct header and return path for each account", () => {
  assert.deepEqual(
    ["admin", "editor", "spokesperson"].map((role) => [
      partnersHeader(role as "admin" | "editor" | "spokesperson"),
      partnersReturnPath(role as "admin" | "editor" | "spokesperson"),
    ]),
    [
      ["inspector", "/inspetor"],
      ["editor", "/editor"],
      ["spokesperson", "/porta-voz"],
    ]
  );
});
