// Teto de tamanho pra tudo que o usuário escreve.
//
// Ficam AQUI, e não nos formulários, porque `maxLength` no input é conforto:
// some no primeiro `curl`. Quem precisa recusar texto de 10MB é o servidor.
// Por isso o corte acontece na camada que grava no banco — não importa qual
// rota chamou.

export const LIMITES = {
  nome: 80,
  apelido: 24,
  email: 254, // teto do RFC 5321
  localizacao: 80,
  bio: 600,
  headline: 60,
  titulo: 120,
  briefCampo: 120, // tom, cor, fonte, refs
  textoLongo: 2000, // cortes específicos, motivo, notas de reedição
  link: 500,
  tag: 60, // item de software/estilo/bandeira/palavra-chave
} as const;

/** Corta e tira espaço das pontas. `undefined` e `null` passam batido. */
export function limitar(valor: string | null | undefined, max: number): string {
  if (typeof valor !== "string") return "";
  return valor.trim().slice(0, max);
}

/** Igual, mas devolve `null` quando fica vazio — pra coluna que aceita NULL. */
export function limitarOuNulo(
  valor: string | null | undefined,
  max: number
): string | null {
  const t = limitar(valor, max);
  return t === "" ? null : t;
}

/** Lista de tags: corta cada item, tira vazio e repetido, limita a quantidade. */
export function limitarLista(valor: unknown, maxItens: number): string[] {
  if (!Array.isArray(valor)) return [];
  const limpos = valor
    .filter((x): x is string => typeof x === "string")
    .map((x) => limitar(x, LIMITES.tag))
    .filter(Boolean);
  return [...new Set(limpos)].slice(0, maxItens);
}

/**
 * Teto da foto. Ela é gravada como data URL (base64) dentro de uma coluna de
 * texto, então trafega inteira toda vez que o perfil renderiza — uma foto
 * grande demais deixa a tela lenta pra todo mundo que a vê, não só pra quem
 * subiu. base64 infla ~33%, então 2MB aqui é imagem de ~1,5MB.
 */
export const MAX_FOTO_BYTES = 2_000_000;

export function fotoValida(dataUrl: string | undefined | null): boolean {
  if (!dataUrl) return true; // sem foto é permitido
  if (!dataUrl.startsWith("data:image/")) return false;
  return dataUrl.length <= MAX_FOTO_BYTES;
}
