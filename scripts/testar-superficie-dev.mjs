import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/dev/page.tsx", import.meta.url), "utf8");

assert.match(source, /import\s*\{\s*notFound\s*\}\s*from\s*["']next\/navigation["']/);
assert.match(source, /notFound\(\)/, "a página dev precisa desaparecer fora do desenvolvimento");
assert.match(source, /process\.env\.VERCEL/, "a guarda deve considerar a Vercel");

console.log("OK: superfície de desenvolvimento possui guarda de produção");
