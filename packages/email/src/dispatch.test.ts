// O molde do broadcast era o único que interpolava HTML cru. Nome vem do
// cadastro do usuário; texto vem do inspetor. Os dois precisam entrar
// escapados, senão marcação vira marcação de verdade no e-mail.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildPasswordRecoveryEmail, deliverEmail, escapeHtml } from "./messages.ts";

describe("escape em molde de e-mail", () => {
  test("escapa marcação e aspas", () => {
    assert.equal(
      escapeHtml('<script>alert("x")</script>'),
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    assert.equal(escapeHtml("a & b"), "a &amp; b");
  });

  test("o link de recuperação não vaza marcação vinda do nome", () => {
    const { html, subject } = buildPasswordRecoveryEmail(
      '<img src=x onerror="alert(1)">',
      "https://exemplo.local/redefinir?token=abc",
    );
    assert.ok(!html.includes("<img src=x"), "nome entrou como marcação viva");
    assert.ok(html.includes("&lt;img"), "nome deveria estar escapado");
    assert.match(subject, /Recuperar sua senha/);
  });
});

test("recuperação sem provedor não declara envio nem chama a rede", async (t) => {
  const previousKey = process.env.RESEND_API_KEY;
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("O teste não pode enviar e-mail real.");
  });
  try {
    for (const key of [undefined, "dummy"]) {
      if (key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = key;
      assert.equal(
        await deliverEmail("teste@example.invalid", "Recuperação", "<p>Teste</p>"),
        false,
      );
    }
    assert.equal(network.mock.callCount(), 0);
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});
