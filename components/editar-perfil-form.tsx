"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HEADLINES, MAX_HEADLINES } from "@/lib/perfil";
import type { PerfilEditavel } from "@/lib/perfil-db";

function chip(ativo: boolean, bloqueado = false) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    bloqueado ? "cursor-not-allowed opacity-40" : ""
  } ${
    ativo
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

export function EditarPerfilForm({ inicial }: { inicial: PerfilEditavel }) {
  const router = useRouter();
  const [headline, setHeadline] = useState<string[]>(inicial.headline);
  const [localizacao, setLocalizacao] = useState(inicial.localizacao ?? "");
  const [bio, setBio] = useState(inicial.bio ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function alternarHeadline(h: string) {
    setHeadline((a) => {
      if (a.includes(h)) return a.filter((x) => x !== h);
      if (a.length >= MAX_HEADLINES) return a;
      return [...a, h];
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setSalvando(true);

    const resp = await fetch("/api/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, bio, localizacao }),
    });
    setSalvando(false);

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setErro(dados?.erro ?? "Não deu pra salvar. Tenta de novo.");
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
          {/* sem o contador, o usuário só descobria o teto quando os chips
              paravam de responder ao clique */}
          <span className="text-[11px] text-muted-2">
            {headline.length}/{MAX_HEADLINES}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-2">
          Até {MAX_HEADLINES}. Aparecem embaixo do seu nome no perfil.
        </p>
        <div className="flex flex-col gap-3">
          {HEADLINES.map((grupo) => (
            <div key={grupo.categoria}>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-2">
                {grupo.categoria}
              </p>
              <div className="flex flex-wrap gap-2">
                {grupo.tags.map((h) => {
                  const ativo = headline.includes(h);
                  const bloqueado = !ativo && headline.length >= MAX_HEADLINES;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => alternarHeadline(h)}
                      disabled={bloqueado}
                      aria-pressed={ativo}
                      className={chip(ativo, bloqueado)}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
          value={localizacao}
          onChange={(e) => setLocalizacao(e.target.value)}
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

      {erro && (
        <p role="alert" className="mb-4 text-center text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <Link href="/perfil" className="btn-ghost grid w-32 place-items-center">
          Cancelar
        </Link>
        <button type="submit" className="btn-gold flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>

      {/* Esta tela edita 3 campos; o perfil mostra bem mais que isso. Sem
          este aviso, quem quisesse trocar software ou foto ficava sem saber
          por onde — o formulário completo é o do onboarding, que já vem
          preenchido e funciona como edição. */}
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
