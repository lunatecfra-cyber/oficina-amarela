// Portado de scripts/testar-navegacao-parceiros.mjs, que importava um módulo
// renomeado. As expectativas foram reescritas contra o comportamento atual: o
// inspetor passou a ter cabeçalho próprio, o script antigo ainda esperava o de
// porta-voz.

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { partnersHeader, partnersReturnPath } from "./navigation.ts";

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

  test("sem sessão preserva a área informada pelo link", () => {
    assert.equal(partnersHeader(null, "spokesperson"), "spokesperson");
    assert.equal(partnersHeader(null, "admin"), "inspector");
    assert.equal(partnersHeader(null, "editor"), "editor");
  });
});

describe("caminho de volta da página de parceiros", () => {
  test("cada papel volta para a própria área", () => {
    assert.equal(partnersReturnPath("admin"), "/inspetor");
    assert.equal(partnersReturnPath("spokesperson"), "/porta-voz");
    assert.equal(partnersReturnPath("editor"), "/editor");
  });

  test("sem sessão volta para a home", () => {
    assert.equal(partnersReturnPath(null), "/");
    assert.equal(partnersReturnPath(undefined), "/");
  });

  test("sem sessão volta para a área informada pelo link", () => {
    assert.equal(partnersReturnPath(null, "spokesperson"), "/porta-voz");
    assert.equal(partnersReturnPath(null, "admin"), "/inspetor");
    assert.equal(partnersReturnPath(null, "editor"), "/editor");
  });
});
