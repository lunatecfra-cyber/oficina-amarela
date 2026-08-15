"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NovidadeDb } from "@/lib/novidades-db";

/**
 * Onde as novidades da página de entrada são escritas.
 *
 * Elas aparecem numa página pública, sem login — então o texto daqui é a
 * primeira coisa que alguém de fora lê sobre o produto. Por isso a dica de
 * escrever o que muda pra quem usa, e não o que mudou no código.
 */
export function PainelNovidades({ iniciais }: { iniciais: NovidadeDb[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function chamar(corpo: Record<string, unknown>): Promise<boolean> {
    const resp = await fetch("/api/admin/novidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setAviso(d?.erro ?? "Não deu pra concluir.");
      return false;
    }
    setAviso("");
    return true;
  }

  async function publicar() {
    if (!titulo.trim()) return setAviso("Escreva um título.");
    if (!texto.trim()) return setAviso("Escreva o texto.");
    setSalvando(true);
    const ok = await chamar({ acao: "criar", titulo: titulo.trim(), texto: texto.trim() });
    setSalvando(false);
    if (!ok) return;
    setTitulo("");
    setTexto("");
    router.refresh();
  }

  async function alternar(n: NovidadeDb) {
    if (!(await chamar({ acao: "alternar", id: n.id }))) return;
    setLista((l) => l.map((x) => (x.id === n.id ? { ...x, publicada: !x.publicada } : x)));
    router.refresh();
  }

  async function apagar(n: NovidadeDb) {
    if (!(await chamar({ acao: "apagar", id: n.id }))) return;
    setLista((l) => l.filter((x) => x.id !== n.id));
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Novidades
      </h1>
      <p className="mt-1 text-sm text-muted">
        Aparecem na página inicial, para quem ainda nem tem conta.
      </p>

      {/* ---- escrever ---- */}
      <section className="mt-8 rounded-2xl border border-gold-lo/40 bg-gradient-to-b from-gold/[0.05] to-transparent p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Escrever uma novidade
        </h2>

        <label className="mt-4 block">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Título
          </span>
          <input
            className="field-input !pl-4"
            placeholder="ex.: Avisos por e-mail"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              setAviso("");
            }}
            maxLength={120}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            O que muda pra quem usa
          </span>
          <textarea
            className="field-input !pl-4 min-h-28 resize-y py-3"
            placeholder="Uma ou duas frases. Escreva o que a pessoa ganha, não o que mudou no código."
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAviso("");
            }}
            maxLength={2000}
          />
        </label>

        {aviso && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {aviso}
          </p>
        )}

        <button className="btn-gold mt-4 w-full sm:w-52" onClick={publicar} disabled={salvando}>
          {salvando ? "Publicando…" : "Publicar"}
        </button>
      </section>

      {/* ---- o que já existe ---- */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.14em] text-gold">
          Publicadas ({lista.length})
        </h2>

        {lista.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
            Nenhuma ainda. Enquanto não houver, a página inicial mostra o texto
            que veio junto com o sistema.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {lista.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border bg-surface/60 p-4 ${
                  n.publicada ? "border-line" : "border-line-soft opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                      {n.titulo}
                    </h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.texto}</p>
                    <p className="mt-2 text-[11px] text-muted-2">
                      {new Date(n.criadaEm).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {n.autor && ` · ${n.autor}`}
                      {!n.publicada && " · fora do ar"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost w-36 !py-2 text-xs" onClick={() => alternar(n)}>
                    {n.publicada ? "Tirar do ar" : "Pôr no ar"}
                  </button>
                  <button
                    className="btn-ghost w-28 !py-2 text-xs !text-muted-2 hover:!border-danger/40 hover:!text-danger"
                    onClick={() => apagar(n)}
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
