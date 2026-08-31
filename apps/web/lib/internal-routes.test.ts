import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Todo link interno tem que cair numa página que existe.
 *
 * As páginas são em PT-BR (`/porta-voz`, `/inspetor`, `/criar-conta`) e boa
 * parte do código nasceu em inglês. A mistura já produziu 404 em cima de ação
 * bem-sucedida: o proxy e o login mandavam o porta-voz para "/spokesperson"
 * depois de acertar a senha, os cards da área dele apontavam para
 * "/spokesperson/mission/:id" e o banner de perfil incompleto para
 * "/spokesperson/create-profile". Nenhuma das três existe.
 *
 * O tipo de erro que nenhum typecheck pega — href é string — e que só aparece
 * clicando. Por isso a conferência é contra a árvore de rotas de verdade, e
 * não contra uma lista escrita à mão que envelhece junto.
 */

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(WEB, "app");

function walk(dir: string, onFile: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

/** As rotas que o Next realmente serve: toda pasta de `app/` com um page.tsx. */
function realRoutes(): string[] {
  const routes: string[] = [];
  walk(APP, (file) => {
    const name = path.basename(file);
    if (name !== "page.tsx" && name !== "route.ts") return;
    const rel = path.relative(APP, path.dirname(file)).split(path.sep).join("/");
    routes.push(rel === "" ? "/" : `/${rel}`);
  });
  return routes;
}

/** `/porta-voz/missao/[id]` casa com `/porta-voz/missao/db-12`. */
function routeMatches(route: string, target: string): boolean {
  const routeParts = route.split("/").filter(Boolean);
  const targetParts = target.split("/").filter(Boolean);
  if (routeParts.some((part) => part.startsWith("[...")))
    return targetParts.length >= routeParts.length - 1;
  if (routeParts.length !== targetParts.length) return false;
  return routeParts.every((part, i) => part.startsWith("[") || part === targetParts[i]);
}

/** Só o caminho: fora query, âncora e o que for interpolado em runtime. */
function pathOf(target: string): string | null {
  const clean = target.split("?")[0].split("#")[0];
  if (!clean.startsWith("/")) return null;
  // um `${...}` no meio vira segmento coringa, que casa com qualquer valor
  return clean.replace(/\$\{[^}]*\}/g, "x");
}

function internalTargets(): Array<{ file: string; line: number; target: string }> {
  const found: Array<{ file: string; line: number; target: string }> = [];
  // Uma linha entra na conferência quando NAVEGA; dela saem todos os caminhos
  // literais. Casar a chamada inteira não serve: `router.push(x ? "/a" : "/b")`
  // tem o destino depois de um ternário, e foi assim que "/spokesperson"
  // sobreviveu à primeira versão desta conferência.
  const navigates = /href=|router\.(?:push|replace)\(|\bredirect\(/;
  const literals = /["'`](\/[^"'`\s>]*)["'`]/g;
  for (const dir of [APP, path.join(WEB, "components")]) {
    walk(dir, (file) => {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) return;
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (!navigates.test(line)) return;
        for (const match of line.matchAll(literals)) {
          const target = pathOf(match[1]);
          if (target) found.push({ file: path.relative(WEB, file), line: index + 1, target });
        }
      });
    });
  }
  return found;
}

describe("links internos", () => {
  test("a árvore de rotas foi lida", () => {
    const routes = realRoutes();
    assert.ok(routes.includes("/porta-voz"), "esperava achar a área do porta-voz");
    assert.ok(routes.includes("/criar-conta"), "esperava achar o cadastro");
    assert.ok(routes.length > 20, `poucas rotas encontradas: ${routes.length}`);
  });

  test("todo link interno cai numa página que existe", () => {
    const routes = realRoutes();
    const broken = internalTargets().filter(
      ({ target }) => !routes.some((route) => routeMatches(route, target)),
    );
    assert.deepEqual(
      broken.map(({ file, line, target }) => `${file}:${line} → ${target}`),
      [],
    );
  });
});
