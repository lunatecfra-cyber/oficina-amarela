"use client";

import { initials } from "@oficina/domain/candidates";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_OPTIONS = [
  {
    role: "editor" as const,
    title: "Sou editor",
    description: "Edito vídeo. Quero receber missões, entregar e subir de nível.",
  },
  {
    role: "spokesperson" as const,
    title: "Sou porta-voz",
    description: "Mando o bruto e recebo o vídeo editado.",
  },
];

export function ChooseRoleForm({
  name,
  picture,
  slots,
  nome,
  foto,
  vagas,
}: {
  name?: string;
  picture?: string;
  slots?: {
    editor: { total: number; free?: number; livres?: number };
    spokesperson?: { total: number; free?: number; livres?: number };
    voz?: { total: number; free?: number; livres?: number };
  };
  nome?: string;
  foto?: string;
  vagas?: {
    editor: { total: number; livres: number };
    voz: { total: number; livres: number };
  };
}) {
  const router = useRouter();
  const [submittingRole, setSubmittingRole] = useState<string | null>(null);
  const [error, setError] = useState("");

  const effectiveName = name ?? nome ?? "";
  const effectivePicture = picture ?? foto;
  const effectiveSlots = slots ??
    vagas ?? {
      editor: { total: 0, livres: 0 },
      spokesperson: { total: 0, livres: 0 },
    };

  async function chooseRole(chosenRole: "editor" | "spokesperson") {
    setError("");
    setSubmittingRole(chosenRole);

    const resp = await fetch("/api/auth/google/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: chosenRole,
        papel: chosenRole === "spokesperson" ? "voz" : "editor",
      }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      setError(data.error ?? data.erro ?? "Não deu pra criar a conta. Tenta de novo.");
      setSubmittingRole(null);
      return;
    }

    router.push(data.destination ?? data.destino);
    router.refresh();
  }

  const editorObj = (effectiveSlots as any)?.editor;
  const editorFree = editorObj?.free ?? editorObj?.livres ?? 0;
  const voiceObj = (effectiveSlots as any)?.spokesperson ?? (effectiveSlots as any)?.voz;
  const voiceFree = voiceObj?.free ?? voiceObj?.livres ?? 0;

  return (
    <div className="w-full max-w-sm text-center">
      {effectivePicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={effectivePicture}
          alt={effectiveName}
          className="mx-auto h-16 w-16 rounded-2xl object-cover"
          style={{ boxShadow: "0 0 0 3px var(--color-ink), 0 0 0 4px rgba(244,206,31,0.55)" }}
        />
      ) : (
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl font-[family-name:var(--font-display)] text-xl font-semibold text-black/80"
          style={{
            background: "linear-gradient(135deg,#3a3a42,#12121a)",
            boxShadow: "0 0 0 3px var(--color-ink), 0 0 0 4px rgba(244,206,31,0.55)",
          }}
        >
          {initials(effectiveName)}
        </span>
      )}

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
        Oi, {effectiveName.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted">Falta só uma coisa: você é editor ou porta-voz?</p>

      <div className="mt-6 flex flex-col gap-3">
        {ROLE_OPTIONS.map((o) => {
          const free = o.role === "editor" ? editorFree : voiceFree;
          return (
            <button
              key={o.role}
              type="button"
              onClick={() => chooseRole(o.role)}
              disabled={submittingRole !== null || free === 0}
              className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                  {submittingRole === o.role ? "Entrando…" : o.title}
                </p>
                {free === 0 ? (
                  <span className="shrink-0 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                    lotado
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold">
                    {free} vaga{free !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{o.description}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export { ChooseRoleForm as EscolherPapelForm };
