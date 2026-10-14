"use client";
import { PORTFOLIO_AUTHORIZATION_STATEMENT, type PortfolioSample } from "@oficina/domain/portfolio";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PortfolioSamplePreview } from "./portfolio-sample";

type ManagedSample = PortfolioSample & {
  revision: number;
  editorVisible: number;
  ownerAuthorized: number;
  authorizationStatement: string | null;
  published: number;
  missionId: number;
  deliveryVersion: number;
  editorName: string;
  editorHandle: string;
};
type Portfolio = {
  role: string;
  samples: ManagedSample[];
  eligible: { missionId: number; deliveryVersion: number; title: string }[];
};

export function PortfolioManager() {
  const [data, setData] = useState<Portfolio | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/portfolio", { cache: "no-store" }),
      body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function mutate(path: string, body: unknown, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5">
      <p className="text-sm leading-relaxed text-muted">
        Cada obra começa privada. A divulgação exige seu pedido e autorização do porta-voz, que deve
        declarar ter todas as permissões necessárias para divulgar esta obra. Retirar uma amostra ou
        revogar a autorização preserva a entrega original da missão.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}{" "}
          <button
            className="underline"
            onClick={() =>
              void load()
                .then(() => setError(""))
                .catch((e) => setError(e.message))
            }
          >
            Atualizar
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-gold-hi">
          {notice}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="mt-4 text-muted">
          Carregando amostras…
        </p>
      )}
      {data?.role === "editor" && (
        <div className="mt-5 rounded-xl border border-line p-4">
          <h2 className="font-semibold text-text">Adicionar uma entrega</h2>
          <p className="mt-2 text-sm text-muted">
            Escolha um vídeo finalizado e armazenado na Oficina. Você poderá definir título,
            descrição, especialidades e o instante da prévia antes de solicitar publicação.
          </p>
          {data.eligible.length ? (
            <ul className="mt-3 space-y-3">
              {data.eligible.map((work) => (
                <li
                  key={`${work.missionId}-${work.deliveryVersion}`}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="text-sm text-text">
                    {work.title} · versão {work.deliveryVersion}
                  </span>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      void mutate("/api/portfolio", work, "Amostra adicionada como privada.")
                    }
                  >
                    Adicionar amostra privada
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Nenhuma nova entrega elegível. Finalize uma missão para preparar sua primeira amostra,
              ou gerencie as amostras abaixo.
            </p>
          )}
          <Link href="/editor" className="mt-3 inline-block text-sm text-gold-hi underline">
            Ver minhas missões
          </Link>
        </div>
      )}
      {data?.samples.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-line p-5 text-muted">
          Nenhuma amostra para gerenciar. Obras privadas não aparecem no diretório.
        </p>
      )}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {data?.samples.map((sample) => (
          <article
            key={`${sample.id}-${sample.revision}`}
            className="min-w-0 rounded-xl border border-line p-4"
          >
            <PortfolioSamplePreview sample={sample} />
            <p className="mt-3 text-sm font-medium text-gold-hi">
              {sample.published
                ? "Publicada no diretório"
                : !sample.editorVisible
                  ? "Privada"
                  : !sample.ownerAuthorized
                    ? "Aguardando autorização do porta-voz"
                    : "Autorizada · publicação indisponível"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Missão db-{sample.missionId} · versão {sample.deliveryVersion} · {sample.editorName}
            </p>
            {data.role === "editor" ? (
              <>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void mutate(
                      `/api/portfolio/${sample.id}`,
                      {
                        action: "edit",
                        revision: sample.revision,
                        title: form.get("title"),
                        description: form.get("description"),
                        specialties: form.get("specialties"),
                        previewSeconds: Number(form.get("previewSeconds")),
                      },
                      "Amostra salva como privada. Alterações precisam de nova autorização.",
                    );
                  }}
                >
                  <label className="block text-sm text-text">
                    Título
                    <input
                      name="title"
                      className="input mt-1 w-full"
                      required
                      maxLength={120}
                      defaultValue={sample.title}
                    />
                  </label>
                  <label className="block text-sm text-text">
                    Descrição
                    <textarea
                      name="description"
                      className="input mt-1 w-full"
                      maxLength={1000}
                      defaultValue={sample.description}
                    />
                  </label>
                  <label className="block text-sm text-text">
                    Especialidades
                    <input
                      name="specialties"
                      className="input mt-1 w-full"
                      maxLength={200}
                      defaultValue={sample.specialties}
                    />
                  </label>
                  {sample.mediaKind === "video" && (
                    <label className="block text-sm text-text">
                      Instante da prévia (segundos)
                      <input
                        name="previewSeconds"
                        type="number"
                        className="input mt-1 w-full"
                        min={0}
                        max={3600}
                        step={1}
                        defaultValue={sample.previewSeconds}
                      />
                    </label>
                  )}
                  <p className="text-xs text-muted">
                    Salvar alterações retira a publicação e exige nova autorização.
                  </p>
                  <button className="btn-ghost w-full" disabled={busy}>
                    Salvar amostra privada
                  </button>
                </form>
                <button
                  className="btn-gold mt-3 w-full"
                  disabled={busy || Boolean(sample.editorVisible)}
                  onClick={() =>
                    void mutate(
                      `/api/portfolio/${sample.id}`,
                      { action: "request", revision: sample.revision },
                      "Pedido de publicação registrado. Aguarde as autorizações.",
                    )
                  }
                >
                  Solicitar publicação
                </button>
                {Boolean(sample.editorVisible) && (
                  <button
                    className="btn-ghost mt-3 w-full"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/api/portfolio/${sample.id}`,
                        { action: "remove", revision: sample.revision },
                        "Amostra retirada do portfólio público. A entrega original foi preservada.",
                      )
                    }
                  >
                    Retirar do portfólio público
                  </button>
                )}
              </>
            ) : (
              <div className="mt-4 space-y-3">
                {data.role === "spokesperson" && !sample.ownerAuthorized && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(
                        `/api/portfolio/${sample.id}`,
                        {
                          action: "authorize",
                          revision: sample.revision,
                          rightsConfirmed:
                            new FormData(event.currentTarget).get("rightsConfirmed") === "on",
                        },
                        "Autorização e declaração registradas para esta obra e versão.",
                      );
                    }}
                  >
                    <label className="flex items-start gap-2 text-sm text-text">
                      <input
                        name="rightsConfirmed"
                        type="checkbox"
                        required
                        disabled={busy || !sample.editorVisible}
                      />
                      {PORTFOLIO_AUTHORIZATION_STATEMENT}
                    </label>
                    <button
                      className="btn-gold mt-3 w-full"
                      disabled={busy || !sample.editorVisible}
                    >
                      Autorizar esta amostra
                    </button>
                  </form>
                )}
                {Boolean(sample.ownerAuthorized) && (
                  <button
                    className="btn-ghost w-full"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/api/portfolio/${sample.id}`,
                        { action: "revoke", revision: sample.revision },
                        "Autorização revogada. Novos acessos pelo portfólio foram bloqueados.",
                      )
                    }
                  >
                    Revogar publicação
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
