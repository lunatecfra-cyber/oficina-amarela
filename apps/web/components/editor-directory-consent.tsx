"use client";
import { WORK_PREFERENCE_LABELS } from "@oficina/domain/portfolio";
import { useEffect, useState } from "react";
export function EditorDirectoryConsent() {
  const [data, setData] = useState<{
      visible: boolean;
      portfolioConsent: boolean;
      workPreference: keyof typeof WORK_PREFERENCE_LABELS | null;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    fetch("/api/editors/visibility")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setData({
          visible: Boolean(b.visible),
          portfolioConsent: Boolean(b.portfolioConsent),
          workPreference: b.workPreference ?? null,
        });
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/editors/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setNotice("Preferências de publicação salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <h2 className="text-lg font-semibold text-text">Visibilidade no diretório</h2>
      <p className="mt-2 text-sm text-muted">
        Seu perfil só aparece na busca quando você autoriza. Contatos privados e arquivos das
        missões permanecem protegidos.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="mt-2 text-muted">
          Carregando preferências…
        </p>
      )}
      {data && (
        <>
          <label className="mt-3 block text-sm text-text">
            Preferência de trabalho
            <select
              className="input mt-1 w-full"
              value={data.workPreference ?? ""}
              onChange={(event) => {
                setData({
                  ...data,
                  workPreference: (event.target.value || null) as
                    | keyof typeof WORK_PREFERENCE_LABELS
                    | null,
                });
                setNotice("");
              }}
            >
              <option value="">Ainda não informada</option>
              {Object.entries(WORK_PREFERENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted">
            Esta preferência orienta os convites. Não ativa pagamentos ou cobranças.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={data.visible}
              onChange={(e) => {
                setData({ ...data, visible: e.target.checked });
                setNotice("");
              }}
            />
            Autorizo publicar meu perfil no diretório da Oficina
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={data.portfolioConsent}
              onChange={(e) => {
                setData({ ...data, portfolioConsent: e.target.checked });
                setNotice("");
              }}
            />
            Autorizo divulgar meu link de portfólio informado no perfil; tenho permissão para
            divulgar esses trabalhos
          </label>
          <p className="mt-2 text-xs text-muted">
            Esta opção não publica vídeos privados entregues na plataforma.
          </p>
          <button className="btn-gold mt-4" onClick={() => void save()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar visibilidade"}
          </button>
          {notice && (
            <p role="status" className="mt-2 text-sm text-gold-hi">
              {notice}
            </p>
          )}
        </>
      )}
    </section>
  );
}
