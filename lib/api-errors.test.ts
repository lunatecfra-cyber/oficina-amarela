import assert from "node:assert/strict";
import { test } from "node:test";
import { mensagemDeErro, valeTentarDeNovo } from "./api-errors.ts";

const ehPortugues = (s: string) => !/[a-z] (the|not|may|only|too|please|try) /i.test(s);

test("erro de permissão não vira 'tente de novo'", () => {
  const proibido = mensagemDeErro(403, "Não deu pra concluir. Tente de novo.");
  const servidor = mensagemDeErro(500, "Não deu pra concluir. Tente de novo.");

  assert.notEqual(proibido, servidor, "403 e 500 não podem dizer a mesma coisa");
  assert.match(proibido, /acesso/i);
  assert.equal(valeTentarDeNovo(403), false, "insistir num 403 nunca resolve");
  assert.equal(valeTentarDeNovo(500), true);
  assert.equal(valeTentarDeNovo(429), true);
});

test("os códigos que o usuário alcança sozinho têm frase própria", () => {
  // vistos de verdade nas rotas: 413 no upload de vídeo, 429 no limite por hora
  assert.match(mensagemDeErro(413), /grande/i);
  assert.match(mensagemDeErro(429), /espere|muitas vezes/i);
  assert.match(mensagemDeErro(401), /sess[ãa]o/i);
});

test("nenhuma resposta sai em inglês, mesmo com o texto da API como reserva", () => {
  // as rotas respondem assim hoje — o texto não pode vazar pra tela
  const crus = [
    "Mission not found.",
    "Only spokespersons may dispatch missions.",
    "File exceeds max 2 GB limit.",
    "Too many uploads in the past hour. Please try again later.",
  ];
  for (const cru of crus) {
    for (const status of [401, 403, 404, 413, 429, 500, 503]) {
      const saida = mensagemDeErro(status, cru);
      assert.notEqual(saida, cru, `${status} repassou o texto cru`);
      assert.ok(ehPortugues(saida), `${status} devolveu inglês: ${saida}`);
    }
  }
});
