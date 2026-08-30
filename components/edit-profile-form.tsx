"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HEADLINES, MAX_HEADLINES } from "@/lib/profile";
import type { EditableProfile } from "@/lib/profile-db";

function chip(active: boolean, blocked = false) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    blocked ? "cursor-not-allowed opacity-40" : ""
  } ${
    active
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

export function EditProfileForm({
  initial,
  inicial,
}: {
  initial?: EditableProfile;
  inicial?: EditableProfile;
}) {
  const router = useRouter();
  const data = initial ?? inicial ?? { headline: [], location: "", localizacao: "", bio: "" };
  const [headline, setHeadline] = useState<string[]>(data.headline ?? []);
  const [location, setLocation] = useState(data.location ?? (data as any).localizacao ?? "");
  const [bio, setBio] = useState(data.bio ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function toggleHeadline(h: string) {
    setHeadline((a) => {
      if (a.includes(h)) return a.filter((x) => x !== h);
      if (a.length >= MAX_HEADLINES) return a;
      return [...a, h];
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    const resp = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, bio, location, localizacao: location }),
    });
    setIsSaving(false);

    if (!resp.ok) {
      const respData = await resp.json().catch(() => null);
      setError(respData?.error ?? respData?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    router.push("/perfil");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-lg" noValidate>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Especialidades
          </label>
          <span className="text-[11px] text-muted-2">
            {headline.length}/{MAX_HEADLINES}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-2">
          Até {MAX_HEADLINES}. Aparecem embaixo do seu nome no perfil.
        </p>
        <div className="flex flex-col gap-3">
          {HEADLINES.map((group) => {
            const category = group.category ?? (group as any).categoria;
            return (
              <div key={category}>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-2">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((h) => {
                    const active = headline.includes(h);
                    const blocked = !active && headline.length >= MAX_HEADLINES;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggleHeadline(h)}
                        disabled={blocked}
                        aria-pressed={active}
                        className={chip(active, blocked)}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {headline.length >= MAX_HEADLINES && (
          <p className="mt-2 text-xs text-muted-2">
            Máximo de {MAX_HEADLINES} especialidades.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="localizacao"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          Onde você fica
        </label>
        <input
          id="localizacao"
          className="field-input !pl-4"
          placeholder="Ex: Petrópolis, RJ"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="bio"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          Sobre você
        </label>
        <textarea
          id="bio"
          className="field-input !pl-4"
          rows={5}
          placeholder="Como você edita, o que curte pegar, seu ritmo…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Link href="/perfil" className="btn-ghost grid w-32 place-items-center">
          Cancelar
        </Link>
        <button type="submit" className="btn-gold flex-1" disabled={isSaving}>
          {isSaving ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>

      <p className="mt-6 border-t border-line pt-4 text-xs text-muted-2">
        Foto, softwares, estilos, formato, nível de edição e setup ficam no
        formulário completo.{" "}
        <Link href="/editor/criar-perfil" className="text-gold-hi hover:underline">
          Editar a bancada →
        </Link>
      </p>
    </form>
  );
}

export { EditProfileForm as EditarPerfilForm };
