import assert from "node:assert/strict";
import fs from "node:fs";

const navEditor = fs.readFileSync("components/nav-editor.tsx", "utf8");
const devToolbar = fs.readFileSync("components/dev-toolbar.tsx", "utf8");
const parceiros = fs.readFileSync("app/parceiros/page.tsx", "utf8");

assert.match(navEditor, /className=\{`[^`]*min-w-0/);
assert.match(devToolbar, /max-w-\[calc\(100vw-1rem\)\]/);
assert.match(parceiros, /<li key=\{c\.nome\} className="min-w-0">/);

console.log("Contrato de layout mobile aprovado.");
