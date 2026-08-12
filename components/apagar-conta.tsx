"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Zona de risco: apagar a conta pra valer.
 *
 * Dois passos de propósito. O primeiro clique só revela o formulário; quem
 * apaga é o segundo, depois de digitar a senha. Não dá pra fazer isso por
 * engano, e é a mesma ideia de confirmar antes de qualquer ação irreversível.
 */
export function ApagarConta({ temSenha }: { temSenha: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState("");
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!confirmacao) {
      setAviso(temSenha ? "Digite sua senha." : "Digite seu apelido.");
      return;
    }
    setAviso("");
    setApagando(true);

    const resp = await fetch("/api/conta", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacao }),
    });

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setAviso(dados?.erro ?? "Não deu pra apagar. Tenta de novo.");
      setApagando(false);
      return;
    }

    // a sessão morreu junto com a conta — não dá pra voltar pra nenhuma tela
    // logada, então vai pra home
    router.push("/");
    router.refresh();
  }

  return (
    <section className="mt-12 rounded-2xl border border-danger/30 bg-danger/[0.04] p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-danger">
        Zona de risco
      </h2>

      {!aberto ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Apagar a conta remove seu perfil, suas missões e seu histórico. Não
            tem como desfazer.
          </p>
          <button
            className="btn-ghost mt-4 w-auto px-5 !border-danger/40 !text-danger hover:!bg-danger/10"
            onClick={() => setAberto(true)}
          >
            Apagar minha conta
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Isso apaga <b className="text-text">tudo</b> e não dá pra voltar
            atrás. {temSenha ? "Digite sua senha" : "Digite seu apelido"} pra
            confirmar.
          </p>

          <input
            type={temSenha ? "password" : "text"}
            className="field-input !pl-4 mt-4"
            placeholder={temSenha ? "sua senha" : "seu apelido"}
            autoComplete={temSenha ? "current-password" : "off"}
            value={confirmacao}
            onChange={(e) => {
              setConfirmacao(e.target.value);
              setAviso("");
            }}
            autoFocus
          />

          {aviso && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {aviso}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-ghost sm:w-40 !border-danger/50 !text-danger hover:!bg-danger/10"
              onClick={apagar}
              disabled={apagando}
            >
              {apagando ? "Apagando…" : "Apagar pra sempre"}
            </button>
            <button
              className="btn-ghost sm:w-32"
              onClick={() => {
                setAberto(false);
                setConfirmacao("");
                setAviso("");
              }}
              disabled={apagando}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
