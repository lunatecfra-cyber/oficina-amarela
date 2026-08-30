import assert from "node:assert/strict";

const { cabecalhoParceiros } = await import("../lib/navegacao.ts");

assert.equal(
  cabecalhoParceiros("voz"),
  "porta-voz",
  "porta-voz deve manter o cabeçalho de porta-voz",
);
assert.equal(
  cabecalhoParceiros("admin"),
  "porta-voz",
  "inspetor deve manter o cabeçalho de porta-voz/inspetor",
);
assert.equal(cabecalhoParceiros("editor"), "editor", "editor deve manter o cabeçalho de editor");

console.log("OK: cabeçalho de Parceiros respeita o papel da sessão");
