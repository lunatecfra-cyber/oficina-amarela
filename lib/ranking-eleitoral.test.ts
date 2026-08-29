import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMetaSemanal,
  calcularPremios,
  calcularConstancia,
  convitePodeSerUsado,
  indicacaoPodePremiar,
  ordenarRanking,
  PREMIOS_ELEITORAIS,
} from "./ranking-eleitoral.ts";

test("semana parcial de ate quatro dias exige um video", () => {
  assert.equal(calcularMetaSemanal(4), 1);
  assert.equal(calcularMetaSemanal(5), 2);
  assert.equal(calcularMetaSemanal(7), 2);
});

test("premios sao liberados nos marcos definidos", () => {
  assert.deepEqual(calcularPremios(9), []);
  assert.deepEqual(calcularPremios(10), ["ingresso_top1"]);
  assert.deepEqual(calcularPremios(30), ["ingresso_top1", "bandeira_top2", "caneca_top3"]);
  assert.deepEqual(calcularPremios(50), [
    "ingresso_top1",
    "bandeira_top2",
    "caneca_top3",
    "sorteio_constancia",
  ]);
});

test("marcos da vitrine batem com calcularPremios", () => {
  // A tela promete "N ativos" para cada prêmio; aqui provamos que, com
  // exatamente N ativos, calcularPremios de fato libera aquele prêmio — e que
  // com um ativo a menos ele ainda não sai.
  for (const { chave, ativos } of PREMIOS_ELEITORAIS) {
    assert.ok(
      calcularPremios(ativos).includes(chave),
      `${chave} deveria estar liberado com ${ativos} ativos`,
    );
    assert.ok(
      !calcularPremios(ativos - 1).includes(chave),
      `${chave} não deveria estar liberado com ${ativos - 1} ativos`,
    );
  }
  // e a vitrine cobre todos os prêmios que a lógica sabe liberar
  assert.deepEqual(
    PREMIOS_ELEITORAIS.map((p) => p.chave),
    calcularPremios(Infinity),
  );
});

test("empate favorece quem atingiu a quantidade primeiro", () => {
  const ranking = ordenarRanking([
    { editorId: 2, quantidade: 4, atingiuQuantidadeEm: new Date("2026-09-03T12:00:00Z") },
    { editorId: 1, quantidade: 4, atingiuQuantidadeEm: new Date("2026-09-02T12:00:00Z") },
    { editorId: 3, quantidade: 5, atingiuQuantidadeEm: new Date("2026-09-04T12:00:00Z") },
  ]);
  assert.deepEqual(ranking.map((item) => item.editorId), [3, 1, 2]);
});

test("convite exige email, validade e disponibilidade", () => {
  const agora = new Date("2026-09-01T12:00:00Z");
  const base = {
    email: "voz@exemplo.com",
    expiraEm: new Date("2026-09-08T12:00:00Z"),
    usadoEm: null,
    revogadoEm: null,
  };
  assert.equal(convitePodeSerUsado(base, "VOZ@EXEMPLO.COM", agora), true);
  assert.equal(convitePodeSerUsado(base, "outro@exemplo.com", agora), false);
  assert.equal(convitePodeSerUsado({ ...base, usadoEm: agora }, base.email, agora), false);
  assert.equal(
    convitePodeSerUsado({ ...base, expiraEm: new Date("2026-08-31T12:00:00Z") }, base.email, agora),
    false,
  );
});

test("bloqueio salva automaticamente uma semana falhada", () => {
  assert.deepEqual(calcularConstancia([true, true, false, true], 1), {
    sequencia: 4,
    bloqueiosConsumidos: 1,
    elegivelAoSorteio: true,
  });
  assert.deepEqual(calcularConstancia([true, true, false, true], 0), {
    sequencia: 1,
    bloqueiosConsumidos: 0,
    elegivelAoSorteio: false,
  });
});

test("indicacao premia apos dois videos e limita cinco por mes", () => {
  assert.equal(indicacaoPodePremiar(2, 4, false), true);
  assert.equal(indicacaoPodePremiar(1, 4, false), false);
  assert.equal(indicacaoPodePremiar(2, 5, false), false);
  assert.equal(indicacaoPodePremiar(2, 0, true), false);
});
