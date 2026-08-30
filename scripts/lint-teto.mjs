// Falha só se o lint PIORAR.
//
// O projeto tem erros pré-existentes (todos do mesmo padrão: setState dentro
// de efeito). Exigir zero bloquearia qualquer PR até alguém refatorar tudo —
// e aí ninguém liga o CI. Com teto, o erro novo é barrado e o antigo fica
// visível, esperando a vez.
//
// Pra abaixar o teto: corrija erros e diminua o número aqui. Ele só deve
// descer, nunca subir.
//
// Usa a API do ESLint em vez de chamar o binário: `npx` não roda no Windows
// sem shell (Node novo recusa spawn de .cmd), e o `exports` do pacote não
// expõe `bin/eslint.js`. A API funciona igual aqui e no Ubuntu do CI.
import { ESLint } from "eslint";

const TETO_ERROS = 5;
const TETO_AVISOS = 1;

const eslint = new ESLint();
const resultados = await eslint.lintFiles(["."]);

const erros = resultados.reduce((a, r) => a + r.errorCount, 0);
const avisos = resultados.reduce((a, r) => a + r.warningCount, 0);

console.log(`erros:  ${erros} (teto ${TETO_ERROS})`);
console.log(`avisos: ${avisos} (teto ${TETO_AVISOS})`);

if (erros > TETO_ERROS || avisos > TETO_AVISOS) {
  // só imprime arquivo com problema, pra saída não virar parede de texto
  for (const r of resultados) {
    if (!r.errorCount && !r.warningCount) continue;
    console.error(`\n${r.filePath}`);
    for (const m of r.messages) {
      const tipo = m.severity === 2 ? "erro " : "aviso";
      console.error(`  ${tipo} ${m.line}:${m.column}  ${m.message}  [${m.ruleId ?? "?"}]`);
    }
  }
  console.error(
    `\n::error::Lint piorou (${erros} erros / ${avisos} avisos; teto ${TETO_ERROS}/${TETO_AVISOS}). Corrija o que foi introduzido.`,
  );
  process.exit(1);
}

console.log("lint dentro do teto");
