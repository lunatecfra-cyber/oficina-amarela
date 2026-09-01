// O hash do convite mudou de node:crypto para a Web Crypto, e os convites já
// emitidos continuam no banco com o hash antigo. Os vetores abaixo saíram do
// próprio node:crypto: se a implementação sair deles, todo convite pendente
// para de bater no resgate.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateInvitationToken,
  hashInvitation,
  normalizeInvitationEmail,
} from "./invitations.ts";

test("o hash é SHA-256 em hexadecimal, igual ao que já está gravado", async () => {
  assert.equal(
    await hashInvitation(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    await hashInvitation("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("acento entra como UTF-8, não como latin-1", async () => {
  // "ç" tem dois bytes em UTF-8; se o encoder errar, o hash sai outro.
  assert.equal(
    await hashInvitation("ç"),
    "8bfa829b8119a6f39b91fd8decec63830b556e4d88a9da29334d7b0558829f2d",
  );
});

test("o token tem 32 bytes em hexadecimal e não repete", () => {
  const token = generateInvitationToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.notEqual(token, generateInvitationToken());
});

test("e-mail inaceitável não vira convite", () => {
  assert.equal(normalizeInvitationEmail("  VOZ@Exemplo.COM "), "voz@exemplo.com");
  assert.equal(normalizeInvitationEmail("sem-arroba"), null);
  assert.equal(normalizeInvitationEmail(42), null);
});
