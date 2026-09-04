import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("API de musicas nao devolve mensagens de erro em ingles", async () => {
  const route = await readFile(
    new URL("../app/api/tools/music/route.ts", import.meta.url),
    "utf8",
  );

  for (const message of [
    "Please log in first",
    "Only video editors",
    "Invalid form payload",
    "Please upload an audio file",
    "Unsupported audio format",
    "File exceeds",
    "Please provide a track title",
  ]) {
    assert.doesNotMatch(route, new RegExp(message));
  }
});
