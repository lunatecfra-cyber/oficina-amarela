import { fetchApiJson } from "@/lib/internal-api";

export async function getElectoralRanking() {
  const data = await fetchApiJson<any>("/ranking");
  return data ?? {
    items: [],
    itens: [],
    cycle: null,
    ciclo: null,
    activeEditors: 0,
    editoresAtivos: 0,
    highestActiveCount: 0,
    maiorNumeroDeAtivos: 0,
    awards: [],
    premios: [],
    eligibleForDraw: [],
    elegiveisSorteio: [],
  };
}
export const obterRankingEleitoral = getElectoralRanking;

export async function getEditorProgress(_editorId?: number) {
  const data = await fetchApiJson<any>("/editor/progress");
  return data ?? {
    weeks: [],
    semanas: [],
    shields: 0,
    bloqueios: 0,
    referralCode: null,
    codigo_indicacao: null,
    sequence: 0,
    sequencia: 0,
    eligibleForDraw: false,
    elegivelAoSorteio: false,
  };
}
export const obterProgressoEditor = getEditorProgress;
