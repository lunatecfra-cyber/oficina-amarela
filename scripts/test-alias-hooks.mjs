// Resolve o alias "@/..." do tsconfig para o node:test rodar módulos de lib/.
//
//   node --import ./scripts/test-alias-hooks.mjs --test lib/*.test.ts
//
// O Node executa TypeScript direto (type stripping), mas não lê `paths` do
// tsconfig. São ~20 linhas em vez de mais uma dependência de build.

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.js"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

    const base = path.join(root, specifier.slice(2));
    for (const ext of EXTENSIONS) {
      const candidate = base + ext;
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw new Error(`Alias "@/" não resolveu: ${specifier}`);
  },
});
