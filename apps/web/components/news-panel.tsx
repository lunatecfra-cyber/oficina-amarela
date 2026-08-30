"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NewsItemDb, NovidadeDb } from "@/lib/news-db";

export function NewsPanel({
  initials,
  iniciais,
}: {
  initials?: NewsItemDb[];
  iniciais?: NovidadeDb[];
}) {
  const router = useRouter();
  const rawList = (initials ?? iniciais ?? []) as NewsItemDb[];
  const [list, setList] = useState(rawList);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [warning, setWarning] = useState("");

  async function callApi(body: Record<string, unknown>): Promise<boolean> {
    const resp = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setWarning(d?.error ?? d?.erro ?? "Não deu pra concluir.");
      return false;
    }
    setWarning("");
    return true;
  }

  async function handlePublish() {
    if (!title.trim()) return setWarning("Escreva um título.");
    if (!text.trim()) return setWarning("Escreva o texto.");
    setIsSaving(true);
    const ok = await callApi({
      action: "create",
      title: title.trim(),
      text: text.trim(),
      acao: "criar",
      titulo: title.trim(),
      texto: text.trim(),
    });
    setIsSaving(false);
    if (!ok) return;
    setTitle("");
    setText("");
    router.refresh();
  }

  async function handleToggle(n: NewsItemDb) {
    if (!(await callApi({ action: "toggle", id: n.id, acao: "alternar" }))) return;
    setList((l) =>
      l.map((x) => {
        const isPub = x.published ?? (x as any).publicada;
        return x.id === n.id ? { ...x, published: !isPub, publicada: !isPub } : x;
      }),
    );
    router.refresh();
  }

  async function handleDelete(n: NewsItemDb) {
    if (!(await callApi({ action: "delete", id: n.id, acao: "apagar" }))) return;
    setList((l) => l.filter((x) => x.id !== n.id));
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
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setWarning("");
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
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setWarning("");
            }}
            maxLength={2000}
          />
        </label>

        {warning && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {warning}
          </p>
        )}

        <button
          className="btn-gold mt-4 w-full sm:w-52"
          onClick={handlePublish}
          disabled={isSaving}
        >
          {isSaving ? "Publicando…" : "Publicar"}
        </button>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.14em] text-gold">
          Publicadas ({list.length})
        </h2>

        {list.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
            Nenhuma ainda. Enquanto não houver, a página inicial mostra o texto que veio junto com o
            sistema.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {list.map((n) => {
              const itemTitle = n.title ?? (n as any).titulo;
              const itemText = n.text ?? (n as any).texto;
              const itemCreatedAt = n.createdAt ?? (n as any).criadaEm;
              const itemAuthor = n.author ?? (n as any).autor;
              const isPub = n.published ?? (n as any).publicada;

              return (
                <li
                  key={n.id}
                  className={`rounded-2xl border bg-surface/60 p-4 ${
                    isPub ? "border-line" : "border-line-soft opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                        {itemTitle}
                      </h3>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted">{itemText}</p>
                      <p className="mt-2 text-[11px] text-muted-2">
                        {new Date(itemCreatedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {itemAuthor && ` · ${itemAuthor}`}
                        {!isPub && " · fora do ar"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-ghost w-36 !py-2 text-xs"
                      onClick={() => handleToggle(n)}
                    >
                      {isPub ? "Tirar do ar" : "Pôr no ar"}
                    </button>
                    <button
                      className="btn-ghost w-28 !py-2 text-xs !text-muted-2 hover:!border-danger/40 hover:!text-danger"
                      onClick={() => handleDelete(n)}
                    >
                      Apagar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export { NewsPanel as PainelNovidades };
