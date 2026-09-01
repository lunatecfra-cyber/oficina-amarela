import { fetchApiJson } from "@/lib/internal-api";

export async function getElectoralRanking() {
  const data = await fetchApiJson<any>("/ranking");
  return (
    data ?? {
      items: [],
      cycle: null,
      activeEditors: 0,
      highestActiveCount: 0,
      awards: [],
      eligibleForDraw: [],
    }
  );
}

export async function getEditorProgress(_editorId?: number) {
  const data = await fetchApiJson<any>("/editor/progress");
  return (
    data ?? {
      weeks: [],
      shields: 0,
      referralCode: null,
      sequence: 0,
      eligibleForDraw: false,
    }
  );
}
