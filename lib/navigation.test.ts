// Portado de scripts/testar-navegacao-parceiros.mjs, que importava um módulo
// renomeado. As expectativas foram reescritas contra o comportamento atual: o
// inspetor passou a ter cabeçalho próprio, o script antigo ainda esperava o de
// porta-voz.

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { partnersHeader } from "@/lib/navigation";

describe("cabeçalho da página de parceiros", () => {
  test("porta-voz mantém o cabeçalho de porta-voz", () => {
    assert.equal(partnersHeader("spokesperson"), "spokesperson");
  });

  test("inspetor tem cabeçalho próprio", () => {
    assert.equal(partnersHeader("admin"), "inspector");
  });

  test("editor mantém o cabeçalho de editor", () => {
    assert.equal(partnersHeader("editor"), "editor");
  });

  test("sem sessão cai no cabeçalho de editor", () => {
    assert.equal(partnersHeader(null), "editor");
    assert.equal(partnersHeader(undefined), "editor");
  });
});
