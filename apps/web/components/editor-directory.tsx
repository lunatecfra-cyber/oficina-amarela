"use client";
import { isLikelyUrl } from "@oficina/domain/validators";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type DirectoryDetails, EditorDirectoryDetails } from "./editor-directory-details";

type DirectoryEditor = DirectoryDetails & {
  handle: string;
  name: string;
  styles: string | null;
  niches: string | null;
  available: number;
  rating: number | null;
  ratingCount: number;
  completedCount: number;
  portfolioLink: string | null;
  portfolioCount: number;
};
function labels(value: string | null) {
  if (!value) return "";
  try {
    const data = JSON.parse(value);
    return Array.isArray(data) ? data.join(" · ") : value;
  } catch {
    return value;
  }
}
export function EditorDirectory({ missions }: { missions: { id: string; title: string }[] }) {
  const [editors, setEditors] = useState<DirectoryEditor[] | null>(null),
    [search, setSearch] = useState(""),
    [specialty, setSpecialty] = useState(""),
    [available, setAvailable] = useState(false),
    [mission, setMission] = useState(missions[0]?.id || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async (query: URLSearchParams) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/editors?${query}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setEditors(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o diretório.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const editor = new URLSearchParams(window.location.search).get("editor") || "";
    setSearch(editor);
    void load(new URLSearchParams({ search: editor }));
  }, [load]);
  return (
    <>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(new URLSearchParams({ search, specialty, available: String(available) }));
        }}
      >
        <label className="text-sm text-text">
          Nome ou apelido
          <input
            className="input mt-1 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="text-sm text-text">
          Especialidade ou nicho
          <input
            className="input mt-1 w-full"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Disponíveis para receber oferta agora
        </label>
        <button className="btn-gold" disabled={busy}>
          {busy ? "Buscando…" : "Buscar editores"}
        </button>
      </form>
      {missions.length > 0 ? (
        <label className="mt-5 block text-sm text-text">
          Missão para convite direto
          <select
            className="input mt-1 w-full"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Para convidar um editor,{" "}
          <Link className="text-gold-hi underline" href="/porta-voz/nova-pauta">
            publique uma missão
          </Link>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
      {!editors && !error && (
        <p role="status" className="mt-4 text-muted">
          Carregando editores…
        </p>
      )}
      {editors?.length === 0 && (
        <p className="mt-5 rounded-xl border border-line p-4 text-muted">
          Nenhum perfil publicado corresponde à busca. Os editores precisam autorizar sua presença
          no diretório.
        </p>
      )}
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {editors?.map((e) => (
          <li key={e.handle} className="min-w-0 rounded-xl border border-line p-4">
            <h2 className="font-semibold text-text">{e.name}</h2>
            <p className="text-xs text-muted">@{e.handle}</p>
            <p className="mt-2 break-words text-sm text-muted">
              {[labels(e.styles), labels(e.niches)].filter(Boolean).join(" · ") ||
                "Especialidades não informadas"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {e.ratingCount
                ? `${e.rating?.toFixed(1).replace(".", ",")} ★ · ${e.ratingCount} ${e.ratingCount === 1 ? "avaliação" : "avaliações"}`
                : "Ainda sem avaliação"}
            </p>
            <EditorDirectoryDetails editor={e} />
            <p className="mt-2 text-xs text-muted">{e.portfolioCount} amostras autorizadas</p>
            <Link
              className="mt-3 block text-sm text-gold-hi underline"
              href={`/editores/${e.handle}`}
            >
              Consultar perfil
            </Link>
            {e.portfolioLink && isLikelyUrl(e.portfolioLink) && (
              <a
                className="mt-2 block text-sm text-gold-hi underline"
                href={e.portfolioLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Portfólio autorizado pelo editor
              </a>
            )}
            {mission && e.available && (
              <Link
                className="btn-gold mt-4 w-full"
                href={`/porta-voz/missao/${mission}?editor=${encodeURIComponent(e.handle)}`}
              >
                Convidar para a missão
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
