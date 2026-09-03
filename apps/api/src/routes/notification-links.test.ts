import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * E-mail do backend só linka página pública que existe, em PT-BR.
 *
 * Trazido do `lib/public-routes.test.ts` do trabalho de ranking eleitoral: a
 * conferência de links do web (`apps/web/lib/internal-routes.test.ts`) só
 * enxerga o que NAVEGA (`href=`, `router.push`, `redirect`) — corpo de e-mail
 * nunca navega, então um `/spokesperson/mission/db-12` mandado por e-mail
 * passava em tudo e dava 404 em quem clicava.
 *
 * As páginas são em PT-BR (`/porta-voz`, `/editor`, `/criar-conta`); o
 * benchmark manda identificador em inglês, nunca rota pública.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Todo lugar do backend que monta link público com `${origin}/`. */
const EMITTERS = [
  "routes/mission-lifecycle.ts",
  "routes/editor-queue.ts",
  "routes/admin-routes.ts",
  "routes/admin-invitations.ts",
  "dependencies.ts",
];

const sources = EMITTERS.map((file) => readFileSync(path.join(SRC, file), "utf8")).join("\n");

test("notificações do backend nunca linkam /spokesperson", () => {
  assert.doesNotMatch(sources, /\/spokesperson(?:\/|\b)/);
});

test("links de missão e de pauta nova continuam em PT-BR", () => {
  assert.match(sources, /\/porta-voz\/missao\/db-/);
  assert.match(sources, /\/porta-voz\/nova-pauta/);
});

test("recuperação e convite linkam as páginas públicas certas", () => {
  assert.match(sources, /\/redefinir-senha\?token=/);
  assert.match(sources, /\/criar-conta\?convite=/);
});
