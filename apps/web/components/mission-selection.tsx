"use client";
import type { MissionSelection } from "@oficina/domain/mission-board";
import { isLikelyUrl } from "@oficina/domain/validators";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function list(value: string | null) {
  if (!value) return "";
  try {
    const data = JSON.parse(value);
    return Array.isArray(data) ? data.join(", ") : value;
  } catch {
    return value;
  }
}
export function MissionSelectionPanel({ missionId }: { missionId: number }) {
  const router = useRouter();
  const [data, setData] = useState<MissionSelection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${missionId}/selection`, { cache: "no-store" });
      if (res.status === 404) return;
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os interessados.");
    }
  }, [missionId]);
  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get("editor") ?? "");
    void load();
  }, [load]);
  async function select(editorId: number, kind: "interest" | "direct") {
    setBusy(editorId);
    setError("");
    try {
      const res = await fetch(`/api/missions/${missionId}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editorId, kind }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seleção não concluída.");
    } finally {
      setBusy(null);
    }
  }
  if (!data && !error) return null;
  const interested = data?.candidates.filter((c) => c.interested) || [];
  const direct = search.trim()
    ? data?.candidates.filter(
        (c) =>
          !c.interested &&
          `${c.name} ${c.handle}`
            .toLocaleLowerCase("pt-BR")
            .includes(search.trim().toLocaleLowerCase("pt-BR")),
      ) || []
    : [];
  function editors(candidates: MissionSelection["candidates"]) {
    return (
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {candidates.map((c) => (
          <li key={c.id} className="min-w-0 rounded-xl border border-line p-4">
            <h3 className="font-semibold text-text">{c.name}</h3>
            <p className="text-xs text-muted">@{c.handle}</p>
            {c.headline && <p className="mt-2 text-sm text-muted">{c.headline}</p>}
            <p className="mt-2 break-words text-sm text-muted">
              {[list(c.styles), list(c.niches)].filter(Boolean).join(" · ") ||
                "Especialidades não informadas"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {c.ratingCount
                ? `${Number(c.rating).toFixed(1).replace(".", ",")} ★ · ${c.ratingCount} ${c.ratingCount === 1 ? "avaliação" : "avaliações"}`
                : "Sem avaliações de porta-vozes"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {c.eligible ? "Disponível para receber oferta" : "Indisponível para nova oferta"}
            </p>
            <Link
              className="mt-3 block text-sm text-gold-hi underline"
              href={`/editores/${c.handle}`}
              target="_blank"
            >
              Ver perfil e portfólio de {c.name}
            </Link>
            {c.portfolioLink && isLikelyUrl(c.portfolioLink) && (
              <a
                href={c.portfolioLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-sm text-gold-hi underline"
              >
                Abrir portfólio publicado
              </a>
            )}
            {data?.status === "disponivel" && c.eligible && !c.offerStatus && (
              <button
                className="btn-gold mt-3 w-full"
                disabled={busy !== null}
                onClick={() => void select(c.id, c.interested ? "interest" : "direct")}
              >
                {busy === c.id
                  ? "Enviando oferta…"
                  : c.interested
                    ? "Selecionar editor"
                    : "Convidar diretamente"}
              </button>
            )}
            {c.offerStatus && (
              <p className="mt-2 text-xs text-muted">
                Oferta{" "}
                {c.offerStatus === "aceita"
                  ? "aceita"
                  : c.offerStatus === "pendente"
                    ? "aguardando aceite"
                    : c.offerStatus === "expirada"
                      ? "expirada"
                      : "recusada"}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="mt-6 rounded-2xl border border-line p-4" aria-labelledby="selection-title">
      <h2 id="selection-title" className="text-lg font-semibold text-text">
        Escolha do editor
      </h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Atualizar
          </button>
        </p>
      )}
      {data && (
        <>
          <p className="mt-2 text-sm text-muted">
            {data.status === "disponivel"
              ? interested.length
                ? `${interested.length} editor(es) interessado(s). Confira os perfis e escolha um.`
                : "Publicada no mural. Aguardando interessados; você também pode convidar diretamente."
              : data.status === "oferecida"
                ? `Oferta exclusiva enviada a ${data.selected?.name}. Aguardando aceite.`
                : data.selected?.status === "aceita"
                  ? `Oferta aceita por ${data.selected.name}. A missão segue na produção.`
                  : "A missão não está aberta para seleção."}
          </p>
          <p className="mt-1 text-xs text-muted">
            Escolha automática desabilitada. Ofertas valem 5 minutos; recusa ou expiração reabre a
            seleção para outro editor.
          </p>
          {editors(interested)}
          {data.status === "disponivel" && (
            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="direct-editor" className="text-sm text-text">
                Convidar um editor diretamente
              </label>
              <input
                id="direct-editor"
                className="input mt-2 w-full"
                placeholder="Busque por nome ou apelido"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && direct.length === 0 && (
                <p className="mt-2 text-sm text-muted">Nenhum editor encontrado.</p>
              )}
              {editors(direct)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
