// O molde do broadcast era o único que interpolava HTML cru. Nome vem do
// cadastro do usuário; texto vem do inspetor. Os dois precisam entrar
// escapados, senão marcação vira marcação de verdade no e-mail.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildPasswordRecoveryEmail, escapeHtml } from "./messages.ts";

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
