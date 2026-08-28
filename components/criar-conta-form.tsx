"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type VagasInfo = {
  editor: { total: number; inscritos: number; livres: number };
  voz: { total: number; inscritos: number; livres: number };
};

export function CriarContaForm({ modoDev = false }: { modoDev?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [papel, setPapel] = useState<"voz" | "editor">(
    () => (searchParams.get("papel") === "editor" ? "editor" : "voz")
  );
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [vagas, setVagas] = useState<VagasInfo | null>(null);

  useEffect(() => {
    fetch("/api/vagas")
      .then((r) => r.json())
      .then((d: VagasInfo) => setVagas(d))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nome.trim() || !apelido.trim() || !email.trim() || !senha) {
      setErro("Preencha nome, apelido, e-mail e senha.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não são iguais.");
      return;
    }

    setErro("");
    setEnviando(true);
    const resp = await fetch("/api/auth/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, apelido, email, senha, papel }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      setErro(dados.erro ?? "Não deu pra criar a conta.");
      setEnviando(false);
      return;
    }

    // os dois papéis passam pelo assistente de perfil antes da área principal
    router.push(papel === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <a href="/api/auth/google" className="btn-ghost flex items-center justify-center gap-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z"
          />
          <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
          />
        </svg>
        Continuar com Google
      </a>
      <p className="mt-2 text-center text-xs text-muted-2">
        Editor ou porta-voz — você escolhe na próxima tela.
      </p>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs uppercase tracking-[0.15em] text-muted-2">ou crie com senha</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="mb-6 flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setPapel("voz")}
          className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            papel === "voz" ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
          }`}
        >
          Sou porta-voz
        </button>
        <button
          type="button"
          onClick={() => setPapel("editor")}
          className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            papel === "editor" ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
          }`}
        >
          Sou editor
        </button>
      </div>

      {modoDev && (
        <div className="mb-6 rounded-xl border border-gold-lo/30 bg-gold/[0.05] p-4">
          <p className="text-xs leading-relaxed text-muted">
            Ambiente local: veja a área de demonstração sem preencher cadastro.
          </p>
          <a
            href={`/api/auth/dev-login?papel=${papel}&destino=perfil`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-gold-hi transition-colors hover:bg-gold/10 hover:text-gold"
          >
            Criar perfil de demonstração como {papel === "voz" ? "porta-voz" : "editor"}
          </a>
          <a
            href="/criar-conta"
            className="mt-3 block text-center text-xs text-muted-2 transition-colors hover:text-text"
          >
            ← voltar para escolher o papel
          </a>
        </div>
      )}

      {vagas && (
        <p className="mb-4 text-center text-xs text-muted-2">
          {papel === "editor" ? (
            <>
              {vagas.editor.livres === 0 ? (
                <span className="text-danger">Sem vagas de editor no momento.</span>
              ) : (
                <>
                  <span className="font-semibold text-gold">{vagas.editor.livres}</span> vaga
                  {vagas.editor.livres !== 1 ? "s" : ""} de editor{" "}
                  <span className="text-muted-2">
                    ({vagas.editor.inscritos}/{vagas.editor.total})
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              {vagas.voz.livres === 0 ? (
                <span className="text-danger">Sem vagas de candidato no momento.</span>
              ) : (
                <>
                  <span className="font-semibold text-gold">{vagas.voz.livres}</span> vaga
                  {vagas.voz.livres !== 1 ? "s" : ""} de candidato{" "}
                  <span className="text-muted-2">
                    ({vagas.voz.inscritos}/{vagas.voz.total})
                  </span>
                </>
              )}
            </>
          )}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="nome" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            className="field-input"
            placeholder="seu nome"
            autoComplete="name"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErro("");
            }}
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="apelido"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Apelido
          </label>
          <input
            id="apelido"
            name="apelido"
            className="field-input"
            placeholder="ex: jr.eneias"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={apelido}
            onChange={(e) => {
              setApelido(e.target.value);
              setErro("");
            }}
          />
          <p className="mt-1.5 text-xs text-muted-2">3-24 letras, números, ponto ou underline.</p>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field-input"
            placeholder="seu@email.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErro("");
            }}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="senha" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            className="field-input"
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro("");
            }}
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="confirmar"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Confirmar senha
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            className="field-input"
            placeholder="repita a senha"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => {
              setConfirmar(e.target.value);
              setErro("");
            }}
          />
        </div>

        {erro && (
          <p role="alert" className="mb-4 text-center text-sm text-danger">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-gold" disabled={enviando}>
          {enviando ? "Criando conta…" : "Criar minha conta"}
        </button>
      </form>

      {/* /termos e /privacidade existiam sem nenhum caminho até elas. Aqui é
          onde a pessoa decide entrar, então é aqui que precisam estar.
          Falta ainda o registro de consentimento (quem aceitou o quê e
          quando) — ver docs/OBRIGATORIO-LEGAL.md. */}
      <p className="mt-5 text-center text-xs leading-relaxed text-muted-2">
        Ao criar sua conta você concorda com os{" "}
        <Link href="/termos" className="inline-block py-1.5 text-muted hover:text-gold-hi hover:underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="inline-block py-1.5 text-muted hover:text-gold-hi hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <p className="mt-5 text-center text-sm text-muted">
        Já é membro?{" "}
        <Link href="/login" className="inline-block px-2 py-2 font-medium text-gold-hi hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
