"use client";

import Link from "next/link";
import { useState } from "react";

export interface ToolItem {
  name: string;
  url: string;
  note?: string;
  // aliases
  nome?: string;
  nota?: string;
}

export interface ToolCategory {
  name: string;
  emoji: string;
  tools: ToolItem[];
  // aliases
  nome?: string;
  ferramentas?: ToolItem[];
}

export type Ferramenta = ToolItem;
export type Categoria = ToolCategory;

export function ToolsList({
  categories,
  categorias,
}: {
  categories?: ToolCategory[];
  categorias?: ToolCategory[];
}) {
  const [search, setSearch] = useState("");
  const list = categories ?? categorias ?? [];

  const searchTrim = search.trim().toLowerCase();

  const filteredCategories = list
    .map((cat) => {
      const catName = cat.name ?? cat.nome ?? "";
      const tools = cat.tools ?? cat.ferramentas ?? [];
      const filteredTools = tools.filter((f) => {
        if (!searchTrim) return true;
        const name = (f.name ?? f.nome ?? "").toLowerCase();
        const note = (f.note ?? f.nota ?? "").toLowerCase();
        return (
          name.includes(searchTrim) ||
          catName.toLowerCase().includes(searchTrim) ||
          note.includes(searchTrim)
        );
      });

      return {
        ...cat,
        name: catName,
        tools: filteredTools,
        ferramentas: filteredTools,
      };
    })
    .filter((cat) => (cat.tools?.length ?? 0) > 0);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar ferramenta, efeito, áudio..."
            className="w-full rounded-xl border border-line bg-surface/80 pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted-2 outline-none transition-all focus:border-gold/60 focus:bg-surface"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text"
            >
              ✕
            </button>
          )}
        </div>

        {searchTrim && (
          <span className="text-xs text-muted">
            Encontradas{" "}
            <b className="text-gold-hi">
              {filteredCategories.reduce((acc, c) => acc + (c.tools?.length ?? 0), 0)}
            </b>{" "}
            ferramentas
          </span>
        )}
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(!searchTrim || "músicas biblioteca áudio trilha".includes(searchTrim)) && (
          <Link
            href="/ferramentas/musicas"
            className="group flex items-center gap-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.08] to-gold/[0.03] p-5 transition-all duration-300 hover:border-gold/60 hover:shadow-[0_0_32px_rgba(244,206,31,0.1)] sm:col-span-2"
          >
            <span className="inline-grid h-12 w-12 flex-none place-items-center rounded-xl border border-gold/30 bg-gold/10 text-2xl transition-colors group-hover:bg-gold/20">
              🎵
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                Biblioteca de Músicas
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                Upload, player inline, tags por estilo. Organizado pra guilda.
              </p>
            </div>
            <span className="flex-none text-sm font-medium text-gold-hi opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Acessar →
            </span>
          </Link>
        )}

        {filteredCategories.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-line p-12 text-center">
            <span className="text-3xl mb-2 block">🔎</span>
            <p className="text-base font-semibold text-text">Nenhuma ferramenta encontrada</p>
            <p className="mt-1 text-sm text-muted">
              Não encontramos nada para &quot;{search}&quot;. Tente outro termo ou limpe a busca.
            </p>
            <button onClick={() => setSearch("")} className="mt-4 btn-ghost inline-block text-xs">
              Limpar pesquisa
            </button>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div
              key={cat.name}
              className="flex flex-col rounded-2xl border border-line bg-surface/70 transition-all duration-300 hover:border-gold/50 hover:shadow-[0_0_24px_rgba(244,206,31,0.06)]"
            >
              <div className="flex items-center gap-3 rounded-t-[14px] border-b border-gold/20 bg-gradient-to-r from-gold/[0.07] to-transparent px-5 py-4">
                <span className="text-2xl" aria-hidden="true">
                  {cat.emoji}
                </span>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text sm:text-lg">
                  {cat.name}
                </h2>
              </div>

              <ul className="flex flex-col divide-y divide-line/60 px-4 py-2">
                {(cat.tools ?? []).map((f) => {
                  const fName = f.name ?? f.nome ?? "";
                  const fNote = f.note ?? f.nota;
                  return (
                    <li key={fName}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/f flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2.5 text-sm transition-colors hover:text-gold"
                      >
                        <span className="min-w-0 flex-1 text-text font-medium transition-colors group-hover/f:text-gold">
                          {fName}
                        </span>

                        {fNote && (
                          <span className="flex-none rounded-md border border-line-soft bg-surface/90 px-2 py-0.5 text-[10px] text-muted-2">
                            {fNote}
                          </span>
                        )}

                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="h-3.5 w-3.5 flex-none text-muted-2 transition-colors group-hover/f:text-gold ml-1"
                          aria-hidden="true"
                        >
                          <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { ToolsList as ListaFerramentas };
