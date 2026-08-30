"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccount({
  hasPassword,
  temSenha,
}: {
  hasPassword?: boolean;
  temSenha?: boolean;
}) {
  const effectiveHasPassword = hasPassword ?? temSenha ?? false;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirmation) {
      setNotice(effectiveHasPassword ? "Digite sua senha." : "Digite seu apelido.");
      return;
    }
    setNotice("");
    setIsDeleting(true);

    const resp = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation, confirmacao: confirmation }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setNotice(data?.error ?? data?.erro ?? "Não deu pra apagar. Tenta de novo.");
      setIsDeleting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <section className="mt-12 rounded-2xl border border-danger/30 bg-danger/[0.04] p-5">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-danger">Zona de risco</h2>

      {!isOpen ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Apagar a conta remove seu perfil, suas missões e seu histórico. Não tem como desfazer.
          </p>
          <button
            className="btn-ghost mt-4 w-auto px-5 !border-danger/40 !text-danger hover:!bg-danger/10"
            onClick={() => setIsOpen(true)}
          >
            Apagar minha conta
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Isso apaga <b className="text-text">tudo</b> e não dá pra voltar atrás.{" "}
            {effectiveHasPassword ? "Digite sua senha" : "Digite seu apelido"} pra confirmar.
          </p>

          <input
            type={effectiveHasPassword ? "password" : "text"}
            className="field-input !pl-4 mt-4"
            placeholder={effectiveHasPassword ? "sua senha" : "seu apelido"}
            autoComplete={effectiveHasPassword ? "current-password" : "off"}
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              setNotice("");
            }}
            autoFocus
          />

          {notice && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-ghost sm:w-40 !border-danger/50 !text-danger hover:!bg-danger/10"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Apagando…" : "Apagar pra sempre"}
            </button>
            <button
              className="btn-ghost sm:w-32"
              onClick={() => {
                setIsOpen(false);
                setConfirmation("");
                setNotice("");
              }}
              disabled={isDeleting}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export { DeleteAccount as ApagarConta };
