"use client";

import { useState } from "react";

export function SetPassword({
  hasPassword,
  temSenha,
}: {
  hasPassword?: boolean;
  temSenha?: boolean;
}) {
  const effectiveHasPassword = hasPassword ?? temSenha ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (password.length < 6) {
      setNotice("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (password !== repeatPassword) {
      setNotice("As duas senhas não são iguais.");
      return;
    }
    setNotice("");
    setIsSaving(true);

    const resp = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password, novaSenha: password }),
    });
    const data = await resp.json().catch(() => null);
    setIsSaving(false);

    if (!resp.ok) {
      setNotice(data?.error ?? data?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    setPassword("");
    setRepeatPassword("");
    setIsReady(true);
    setIsOpen(false);
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface/60 p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
        {effectiveHasPassword ? "Trocar a senha" : "Criar uma senha"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {effectiveHasPassword
          ? "Vale mesmo que você não lembre a antiga — não vamos pedir por ela."
          : "Sua conta entra pelo Google. Com uma senha, você passa a ter os dois caminhos."}
      </p>

      {isReady && (
        <p role="status" className="mt-3 text-sm text-ok">
          Senha salva. As sessões abertas em outros aparelhos foram encerradas.
        </p>
      )}

      {!isOpen ? (
        <button className="btn-ghost mt-4 w-full sm:w-56" onClick={() => setIsOpen(true)}>
          {effectiveHasPassword ? "Trocar senha" : "Criar senha"}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              Senha nova
            </span>
            <input
              type="password"
              className="field-input !pl-4"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setNotice("");
              }}
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
              Repetir a senha
            </span>
            <input
              type="password"
              className="field-input !pl-4"
              value={repeatPassword}
              onChange={(e) => {
                setRepeatPassword(e.target.value);
                setNotice("");
              }}
              autoComplete="new-password"
            />
          </label>

          {notice && (
            <p role="alert" className="text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar senha"}
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setIsOpen(false);
                setPassword("");
                setRepeatPassword("");
                setNotice("");
              }}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export { SetPassword as DefinirSenha };
