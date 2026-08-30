// Portado de scripts/testar-transicoes-pauta.mjs, que importava um módulo
// renomeado há tempos e por isso não rodava mais.

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { canPerformAction } from "./mission-transitions.ts";

describe("transições de missão", () => {
  const cases: Array<[string, string, string, boolean]> = [
    ["reservada", "editor", "entregar", true],
    ["reedicao", "editor", "entregar", true],
    ["disponivel", "editor", "entregar", false],
    ["em_revisao", "admin", "aprovar", true],
    ["reservada", "admin", "aprovar", false],
    ["aprovada", "voz", "aceitar", true],
    ["em_revisao", "voz", "aceitar", false],
    ["em_revisao", "admin", "desconhecida", false],
    ["disponivel", "editor", "reservar", true],
    ["disponivel", "voz", "reservar", false],
    ["em_revisao", "editor", "reedicao", false],
  ];

  for (const [status, role, action, expected] of cases) {
    test(`${role} ${expected ? "pode" : "não pode"} ${action} em ${status}`, () => {
      assert.equal(canPerformAction(status, role, action), expected);
    });
  }

  test("mensagem e denúncia valem em qualquer estado", () => {
    for (const status of ["disponivel", "reservada", "em_revisao", "finalizada"]) {
      assert.equal(canPerformAction(status, "editor", "mensagem"), true);
      assert.equal(canPerformAction(status, "voz", "denunciar"), true);
    }
  });
});
