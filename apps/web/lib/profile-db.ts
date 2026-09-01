import type { EditorProfile, EditorRanking } from "@oficina/domain/profile";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type {
  CandidateOnboarding,
  EditableProfile,
  EditorOnboarding,
  EditorProfile,
  EditorRanking,
  HistoryItem,
  PortfolioItem,
  SaveCandidateOnboardingInput,
  SaveEditableProfileInput,
  SaveEditorOnboardingInput,
} from "@oficina/db/profiles";

export type PerfilEditavel = import("@oficina/db/profiles").EditableProfile;
export type OnboardingEditor = import("@oficina/db/profiles").EditorOnboarding;
export type PerfilEditor = EditorProfile;
export type RankingEditor = EditorRanking;

export async function readEditableProfile(
  _userId?: number,
): Promise<import("@oficina/db/profiles").EditableProfile | null> {
  return fetchApiJson<import("@oficina/db/profiles").EditableProfile>("/profile");
}

export async function saveEditableProfile(
  _userId: number,
  data: import("@oficina/db/profiles").SaveEditableProfileInput,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const errorMsg = body.error ?? body.erro ?? "Erro ao salvar perfil.";
    return { ok: false, error: errorMsg, erro: errorMsg };
  }
  return { ok: true };
}

export async function readEditorOnboarding(
  _userId?: number,
): Promise<import("@oficina/db/profiles").EditorOnboarding | null> {
  return fetchApiJson<import("@oficina/db/profiles").EditorOnboarding>("/editor/profile");
}

export async function saveEditorOnboarding(
  _userId: number,
  data: import("@oficina/db/profiles").SaveEditorOnboardingInput,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/editor/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const errorMsg = body.error ?? body.erro ?? "Erro ao salvar perfil.";
    return { ok: false, error: errorMsg, erro: errorMsg };
  }
  return { ok: true };
}

export async function readEditorProfile(
  handleOrId: string | number,
): Promise<EditorProfile | null> {
  return fetchApiJson<EditorProfile>(`/editor/profile/${handleOrId}`);
}

export async function readEditorRanking(limit = 10): Promise<EditorRanking[]> {
  const list = await fetchApiJson<EditorRanking[]>(`/editor/ranking?limit=${limit}`);
  return list ?? [];
}

export async function accountHasPassword(_userId?: number): Promise<boolean> {
  const data = await fetchApiJson<{ hasPassword: boolean }>("/account");
  return Boolean(data?.hasPassword);
}
