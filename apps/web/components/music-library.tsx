"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Music {
  id: string;
  name?: string;
  nome?: string;
  tags: string[];
  url: string;
  size?: number | null;
  tamanho?: number | null;
  addedBy?: string | null;
  adicionado_por?: string | null;
  createdAt?: string;
  criado_em?: string;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return `há ${Math.floor(days / 30)} ${days < 60 ? "mês" : "meses"}`;
}

export function MusicLibrary() {
  const [musics, setMusics] = useState<Music[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async (tag?: string) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const q = tag ? `?tag=${encodeURIComponent(tag)}` : "";
      const res = await fetch(`/api/tools/music${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.erro || "Erro ao carregar.");
      setMusics(data.musics ?? data.musicas ?? []);
      setAllTags(data.tags ?? []);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Erro ao carregar músicas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filter = (tag: string) => {
    setActiveTag(tag);
    load(tag || undefined);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/tools/music", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.erro || "Erro ao enviar.");
      formRef.current?.reset();
      load(activeTag || undefined);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar música.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
          🎵 Músicas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Biblioteca compartilhada da guilda. Upload, tags e player embutido.
        </p>

        <div
          className="mt-5 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
          }}
          aria-hidden="true"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => filter("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === ""
                ? "border-gold/60 bg-gold/10 text-gold-hi"
                : "border-line bg-surface/60 text-muted hover:border-gold/40 hover:text-text"
            }`}
          >
            Todos
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => filter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeTag === t
                  ? "border-gold/60 bg-gold/10 text-gold-hi"
                  : "border-line bg-surface/60 text-muted hover:border-gold/40 hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted">Carregando músicas…</div>
      ) : musics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-muted">
            {activeTag
              ? `Nenhuma música com a tag "${activeTag}".`
              : "Nenhuma música ainda. Seja o primeiro a adicionar!"}
          </p>
        </div>
      ) : (
        <ul className="mb-8 flex flex-col gap-3">
          {musics.map((m) => {
            const name = m.name ?? m.nome ?? "";
            const size = m.size ?? m.tamanho;
            const addedBy = m.addedBy ?? m.adicionado_por;
            const createdAt = m.createdAt ?? m.criado_em ?? new Date().toISOString();

            return (
              <li key={m.id}>
                <div className="rounded-2xl border border-line bg-surface/70 p-4 transition-colors hover:border-gold/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <audio
                      controls
                      src={m.url}
                      preload="none"
                      className="w-full sm:w-auto sm:min-w-[200px] sm:flex-none"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-2">
                        {size && <span>{formatSize(size)}</span>}
                        {addedBy && <span>@{addedBy}</span>}
                        <span>{relativeDate(createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {m.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => filter(t)}
                          className="rounded-md border border-gold-lo/30 bg-gold/[0.06] px-2 py-0.5 text-[11px] font-medium text-gold-hi transition-colors hover:bg-gold/10"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.04] to-transparent p-5">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Adicionar música
        </h2>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="musica-arquivo" className="mb-1 block text-sm text-text">
              Arquivo (MP3, WAV ou OGG — máx. 4 MB)
            </label>
            <input
              id="musica-arquivo"
              name="arquivo"
              type="file"
              accept="audio/mpeg,.mp3,audio/wav,.wav,audio/ogg,.ogg"
              required
              className="block w-full text-sm text-muted file:mr-4 file:rounded-xl file:border file:border-gold/30 file:bg-gold/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gold-hi hover:file:bg-gold/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="musica-nome" className="mb-1 block text-sm text-text">
                Nome
              </label>
              <input
                id="musica-nome"
                name="nome"
                type="text"
                maxLength={120}
                required
                placeholder="Ex: Batida Trap 80 BPM"
                className="w-full rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-sm text-text placeholder:text-muted-2 outline-none transition-colors focus:border-gold/50"
              />
            </div>

            <div>
              <label htmlFor="musica-tags" className="mb-1 block text-sm text-text">
                Tags <span className="text-muted-2">(separadas por vírgula)</span>
              </label>
              <input
                id="musica-tags"
                name="tags"
                type="text"
                placeholder="violão, instrumental, alegre"
                className="w-full rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-sm text-text placeholder:text-muted-2 outline-none transition-colors focus:border-gold/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center rounded-xl border border-gold/40 bg-gold/10 px-6 text-sm font-semibold text-gold-hi transition-colors hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Enviando…" : "Enviar música"}
          </button>
        </form>
      </div>
    </div>
  );
}

export { MusicLibrary as BibliotecaMusicas };
