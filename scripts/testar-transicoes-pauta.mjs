import assert from "node:assert/strict";

const { podeExecutarAcao } = await import("../lib/transicoes-pauta.ts");

const casos = [
  ["reservada", "editor", "entregar", true],
  ["reedicao", "editor", "entregar", true],
  ["disponivel", "editor", "entregar", false],
  ["em_revisao", "admin", "aprovar", true],
  ["reservada", "admin", "aprovar", false],
  ["aprovada", "voz", "aceitar", true],
  ["em_revisao", "voz", "aceitar", false],
  ["em_revisao", "admin", "desconhecida", false],
];

for (const [status, papel, acao, esperado] of casos) {
  assert.equal(
    podeExecutarAcao(status, papel, acao),
    esperado,
    `${papel} não deve executar ${acao} em ${status}`,
  );
}

console.log("OK: transições de missão respeitam status, papel e ação");
