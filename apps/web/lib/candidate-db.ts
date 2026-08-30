import type { Candidate } from "@oficina/domain/candidates";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { CandidateOnboarding, SaveCandidateOnboardingInput } from "@oficina/db/profiles";
export type OnboardingCandidato = import("@oficina/db/profiles").CandidateOnboarding;

export async function readCandidateOnboarding(
  _userId?: number,
): Promise<import("@oficina/db/profiles").CandidateOnboarding | null> {
  return fetchApiJson<import("@oficina/db/profiles").CandidateOnboarding>("/spokesperson/profile");
}
export const lerOnboardingCandidato = readCandidateOnboarding;

export async function saveCandidateOnboarding(
  _userId: number,
  data: import("@oficina/db/profiles").SaveCandidateOnboardingInput,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/spokesperson/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; erro?: string };
  if (!res.ok || !body.ok) {
    const errorMsg = body.error ?? body.erro ?? "Erro ao salvar perfil.";
    return { ok: false, error: errorMsg, erro: errorMsg };
  }
  return { ok: true };
}
export const salvarOnboardingCandidato = saveCandidateOnboarding;

export async function readOwnCandidate(_userId?: number): Promise<Candidate | null> {
  return fetchApiJson<Candidate>("/spokesperson/own");
}
export const lerCandidatoProprio = readOwnCandidate;

export async function readPublicCandidate(slug: string): Promise<Candidate | null> {
  return fetchApiJson<Candidate>(`/candidates/${slug}`);
}
export const lerCandidatoPublico = readPublicCandidate;

export async function readCandidatesByHandles(handles: string[]): Promise<Map<string, Candidate>> {
  if (handles.length === 0) return new Map();
  const obj = await fetchApiJson<Record<string, Candidate>>("/candidates/by-handles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handles }),
  });
  const map = new Map<string, Candidate>();
  if (obj && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      map.set(key, val);
    }
  }
  return map;
}
export const lerCandidatosPorApelidos = readCandidatesByHandles;
