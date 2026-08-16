"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciais } from "@/lib/candidatos";

const OPCOES = [
  {
    papel: "editor" as const,
    titulo: "Sou editor",
    descricao: "Edito vídeo. Quero receber missões, entregar e subir de nível.",
  },
  {
    papel: "voz" as const,
    titulo: "Sou porta-voz",
    descricao: "Sou candidato(a). Mando o bruto e recebo o vídeo editado.",
  },
];

export function EscolherPapelForm({
  nome,
  foto,
  vagas,
}: {
  nome: string;
  foto?: string;
  vagas: {
    editor: { total: number; livres: number };
    voz: { total: number; livres: number };
  };
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function escolher(papel: "editor" | "voz") {
    setErro("");
    setEnviando(papel);

    // só o papel vai no corpo — a identidade confirmada pelo Google está num
    // cookie httpOnly que este componente não enxerga, e é de lá que a rota lê
    const resp = await fetch("/api/auth/google/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ papel }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      setErro(dados.erro ?? "Não deu pra criar a conta. Tenta de novo.");
      setEnviando(null);
      return;
    }

    router.push(dados.destino);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm text-center">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto do Google, sem otimização de servidor
        <img
          src={foto}
          alt={nome}
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
          {iniciais(nome)}
        </span>
      )}

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
        Oi, {nome.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted">Falta só uma coisa: você é editor ou porta-voz?</p>

      <div className="mt-6 flex flex-col gap-3">
        {OPCOES.map((o) => {
          const v = vagas[o.papel];
          return (
            <button
              key={o.papel}
              type="button"
              onClick={() => escolher(o.papel)}
              disabled={enviando !== null || v.livres === 0}
              className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                  {enviando === o.papel ? "Entrando…" : o.titulo}
                </p>
                {v.livres === 0 ? (
                  <span className="shrink-0 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                    lotado
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold">
                    {v.livres} vaga{v.livres !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{o.descricao}</p>
            </button>
          );
        })}
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
