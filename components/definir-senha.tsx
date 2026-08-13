"use client";

import { useState } from "react";

/**
 * Define uma senha nova sem pedir a antiga.
 *
 * Quem chega aqui normalmente é quem esqueceu a senha e voltou entrando pela
 * conta Google — pedir a antiga fecharia a porta justamente pra ela. O texto
 * muda conforme a conta já tenha senha ou não, porque são duas situações
 * diferentes: recuperar o acesso perdido, ou ganhar um segundo caminho de
 * entrada além do Google.
 */
export function DefinirSenha({ temSenha }: { temSenha: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [aviso, setAviso] = useState("");
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (senha.length < 6) {
      setAviso("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (senha !== repetir) {
      setAviso("As duas senhas não são iguais.");
      return;
    }
    setAviso("");
    setSalvando(true);

    const resp = await fetch("/api/conta/senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novaSenha: senha }),
    });
    const dados = await resp.json().catch(() => null);
    setSalvando(false);

    if (!resp.ok) {
      setAviso(dados?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    setSenha("");
    setRepetir("");
    setPronto(true);
    setAberto(false);
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface/60 p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
        {temSenha ? "Trocar a senha" : "Criar uma senha"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {temSenha
          ? "Vale mesmo que você não lembre a antiga — não vamos pedir por ela."
          : "Sua conta entra pelo Google. Com uma senha, você passa a ter os dois caminhos."}
      </p>

      {pronto && (
        <p role="status" className="mt-3 text-sm text-ok">
          Senha salva. As sessões abertas em outros aparelhos foram encerradas.
        </p>
      )}

      {!aberto ? (
        <button className="btn-ghost mt-4 w-full sm:w-56" onClick={() => setAberto(true)}>
          {temSenha ? "Trocar senha" : "Criar senha"}
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
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setAviso("");
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
              value={repetir}
              onChange={(e) => {
                setRepetir(e.target.value);
                setAviso("");
              }}
              autoComplete="new-password"
            />
          </label>

          {aviso && (
            <p role="alert" className="text-sm text-danger">
              {aviso}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar senha"}
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setAberto(false);
                setSenha("");
                setRepetir("");
                setAviso("");
              }}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
