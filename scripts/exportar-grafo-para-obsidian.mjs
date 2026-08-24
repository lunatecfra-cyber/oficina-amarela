import fs from "node:fs";
import path from "node:path";

const graphPath = process.argv[2];
const outputDir = process.argv[3];

if (!graphPath || !outputDir) {
  throw new Error("Uso: node exportar-grafo-para-obsidian.mjs <graph.json> <pasta-do-vault>");
}

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
const files = new Map();

for (const node of graph.nodes) {
  if (node.source_file && /\.(tsx?|jsx?|mjs|cjs|sql|json)$/.test(node.source_file)) {
    files.set(node.source_file, node);
  }
}

const noteBySource = new Map();
for (const source of [...files.keys()].sort()) {
  noteBySource.set(source, source.replace(/[\\/:*?"<>|]/g, "__"));
}

const links = new Map([...files.keys()].map((source) => [source, new Map()]));
for (const edge of graph.edges) {
  const source = nodesById.get(edge.source)?.source_file;
  const target = nodesById.get(edge.target)?.source_file;
  if (!source || !target || source === target || !links.has(source) || !links.has(target)) continue;
  const key = `${target}|${edge.relation || "related"}`;
  links.get(source).set(key, edge.relation || "related");
}

const nodesDir = path.join(outputDir, "Nodes");
fs.mkdirSync(nodesDir, { recursive: true });

for (const [source, noteName] of noteBySource) {
  const outgoing = [...links.get(source).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, relation]) => {
      const [target] = key.split("|");
      return `- ${relation}: [[${noteBySource.get(target)}]]`;
    });

  const content = [
    "---",
    "type: system-graph-node",
    `source: ${source}`,
    "---",
    "",
    `# ${source}`,
    "",
    "Nó gerado pelo Graphify a partir do código da Oficina Amarela.",
    "",
    "## Relações",
    "",
    ...(outgoing.length ? outgoing : ["- Nenhuma relação de arquivo detectada."]),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(nodesDir, `${noteName}.md`), content, "utf8");
}

const overviewLinks = [...noteBySource.entries()]
  .filter(([source]) => source.startsWith("app/") || source.startsWith("components/") || source.startsWith("lib/"))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, noteName]) => `- [[Nodes/${noteName}]]`);

const overview = [
  "---",
  "type: system-graph",
  "generated-by: graphify",
  `node-count: ${files.size}`,
  "---",
  "",
  "# Oficina Amarela - Mapa do Sistema",
  "",
  "Mapa de dependências por arquivo, gerado a partir do código local.",
  "Abra o Graph View nesta nota para explorar os nós e suas conexões.",
  "",
  "## Arquivos do sistema",
  "",
  ...overviewLinks,
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "Oficina Amarela - Mapa do Sistema.md"), overview, "utf8");
console.log(`Exportados ${files.size} nós para ${outputDir}`);
