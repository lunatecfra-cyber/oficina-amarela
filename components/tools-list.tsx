"use client";

import { useState } from "react";
import {
  SHORTCUTS,
  TOOL_GROUPS,
  matchesTool,
  type Tool,
  type ToolGroup,
} from "@/lib/tools";

/** Uma ferramenta: nome, o que faz, categoria e o jeito de abrir. Nada além. */
function ToolRow({ tool, groupName }: { tool: Tool; groupName: string }) {
  const coming = tool.status === "em-breve" || !tool.url;

  return (
    <li className="border-b border-line-soft last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`text-sm font-medium ${coming ? "text-muted" : "text-text"}`}
            >
              {tool.name}
            </span>
            {coming && (
              <span className="rounded-full border border-line bg-ink-2 px-2 py-0.5 text-xs text-muted-2">
                em breve
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-2">{tool.what}</p>
          {/* a categoria acompanha a linha: na busca os resultados saem
              misturados entre grupos, e sem isso perde-se a referência */}
          <p className="mt-0.5 text-xs text-muted-2/70">{groupName}</p>
        </div>

        {coming ? (
          <span
            className="flex min-h-11 flex-none items-center rounded-lg px-3 text-xs text-muted-2"
            aria-label={`${tool.name}: ainda não disponível`}
          >
            —
          </span>
        ) : (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 flex-none items-center rounded-lg border border-line px-3 text-xs font-medium text-gold-hi transition-colors hover:border-gold/50 hover:bg-gold/[0.07]"
          >
            Abrir
          </a>
        )}
      </div>
    </li>
  );
}

export function ToolsList() {
  const [search, setSearch] = useState("");
  const term = search.trim();

  const groups: ToolGroup[] = TOOL_GROUPS.map((g) => ({
    ...g,
    tools: g.tools.filter((t) => matchesTool(t, g.name, term)),
  })).filter((g) => g.tools.length > 0);

  const total = groups.reduce((n, g) => n + g.tools.length, 0);

  return (
    <div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-2"
        >
          🔍
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="O que você precisa fazer?"
          aria-label="Buscar ferramenta"
          className="field-input !pl-11 !pr-12"
        />
        {term && (
          <button
            onClick={() => setSearch("")}
            aria-label="Limpar busca"
            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-sm text-muted-2 transition-colors hover:bg-white/5 hover:text-text"
          >
            ✕
          </button>
        )}
      </div>

      {/* Atalhos escritos como a pessoa pensa, não como o menu se chama. */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {SHORTCUTS.map((s) => {
          const active = term.toLowerCase() === s.match;
          return (
            <button
              key={s.label}
              onClick={() => setSearch(active ? "" : s.match)}
              aria-pressed={active}
              className={`flex min-h-11 flex-none items-center whitespace-nowrap rounded-full border px-3.5 text-xs transition-colors ${
                active
                  ? "border-gold bg-gold/15 font-medium text-gold-hi"
                  : "border-line text-muted hover:border-gold-lo/60 hover:text-text"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {term && (
        <p className="mt-4 text-xs text-muted" role="status" aria-live="polite">
          {total === 0
            ? "Nada encontrado."
            : `${total} ${total === 1 ? "resultado" : "resultados"} para “${term}”.`}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <p className="text-sm text-muted">Nenhuma ferramenta pra “{term}”.</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-2">
            Tente uma palavra do que você quer fazer — cortar, legenda, música,
            imagem.
          </p>
          <button onClick={() => setSearch("")} className="btn-ghost mt-5 sm:w-48">
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.id}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span aria-hidden="true" className="text-base">
                  {g.emoji}
                </span>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                  {g.name}
                </h2>
                <span className="text-xs text-muted-2">{g.what}</span>
              </div>

              <ul className="overflow-hidden rounded-2xl border border-line bg-surface/40">
                {g.tools.map((t) => (
                  <ToolRow key={t.name} tool={t} groupName={g.name} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export { ToolsList as ListaFerramentas };
