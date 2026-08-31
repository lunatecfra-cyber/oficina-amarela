import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { formatWhatsapp, isCompleteWhatsapp, normalizeWhatsapp, onlyDigits } from "./whatsapp.ts";

describe("dígitos do WhatsApp", () => {
  test("o mesmo número escrito de vários jeitos vira um valor só", () => {
    for (const written of ["(11) 98765-4321", "11 98765 4321", "11987654321", "+55 11987654321"]) {
      assert.equal(onlyDigits(written), "11987654321", written);
    }
  });

  test("corta no tamanho de um celular com DDD", () => {
    assert.equal(onlyDigits("119876543219999"), "11987654321");
  });
});

describe("formatação para a tela", () => {
  test("vai formatando conforme a pessoa digita", () => {
    assert.equal(formatWhatsapp("1"), "1");
    assert.equal(formatWhatsapp("11"), "11");
    assert.equal(formatWhatsapp("1198"), "(11) 98");
    assert.equal(formatWhatsapp("1198765432"), "(11) 9876-5432");
    assert.equal(formatWhatsapp("11987654321"), "(11) 98765-4321");
  });
});

describe("o que chega ao banco", () => {
  test("aceita fixo com DDD e celular", () => {
    assert.equal(isCompleteWhatsapp("1198765432"), true);
    assert.equal(isCompleteWhatsapp("11987654321"), true);
    assert.equal(normalizeWhatsapp("(11) 98765-4321"), "11987654321");
  });

  // Um telefone pela metade não disca: guardar é dar ao porta-voz um contato
  // que não funciona, e ele só descobre quando precisa.
  test("número incompleto e vazio viram null", () => {
    for (const value of ["", "   ", "119", "119876543", null, undefined]) {
      assert.equal(normalizeWhatsapp(value), null, String(value));
    }
  });

  test("texto sem número nenhum vira null", () => {
    assert.equal(normalizeWhatsapp("meu zap"), null);
  });
});
