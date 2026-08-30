import { glob } from "node:fs/promises";
import { run } from "node:test";
import { spec } from "node:test/reporters";

const files = [];
for await (const file of glob("src/**/*.test.ts")) {
  files.push(file);
}
files.sort();

const testStream = run({ files, concurrency: 1 });
testStream.on("test:fail", () => {
  process.exitCode = 1;
});
testStream.compose(new spec()).pipe(process.stdout);
