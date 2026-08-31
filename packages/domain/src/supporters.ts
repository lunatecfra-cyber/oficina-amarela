/**
 * Quem ajudou a Oficina a existir — a lista que aparece na home.
 *
 * PRA ADICIONAR ALGUÉM: acrescente um item aqui embaixo e salve. Só `name` é
 * obrigatório; sem `photo`, entram as iniciais num círculo, e a pessoa aparece
 * igual às outras. A ordem da lista é a ordem da tela.
 *
 * A foto pode ser:
 *   - um arquivo em `public/apoiadores/` → `photo: "/apoiadores/rafa.jpg"`
 *   - um endereço de imagem na internet → `photo: "https://..."`
 *
 * Corte a foto em quadrado antes de subir (ela é exibida em círculo) e mantenha
 * abaixo de ~200 KB, senão a home fica pesada no celular.
 */
export type Supporter = {
  /** como a pessoa quer ser chamada na tela */
  name: string;
  /** o que ela faz ou fez pela Oficina — uma linha curta */
  role: string;
  /** caminho da foto; sem ela, entram as iniciais */
  photo?: string;
  /** @ da rede, sem o arroba — vira link se preenchido */
  instagram?: string;
};

export const SUPPORTERS: Supporter[] = [
  { name: "Bombeiro Rafa", role: "Porta-voz fundador" },
  { name: "Isa", role: "Editora" },
  { name: "Esther", role: "Editora · Time Rio" },
  { name: "Igor", role: "Editor · Time Rio" },
  { name: "Marcia Lima", role: "Porta-voz" },
  { name: "Busnelo", role: "Porta-voz" },
];
