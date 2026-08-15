"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginFormConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apelido, setApelido] = useState("");
  const [senha, setSenha] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [erro, setErro] = useState(searchParams.get("erro_google") ?? "");
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apelido.trim() || !senha) {
      setErro(
        !apelido.trim() && !senha
          ? "Preencha apelido e senha."
          : !apelido.trim()
            ? "Digite seu apelido."
            : "Digite sua senha."
      );
      return;
    }
    setErro("");
    setEnviando(true);

    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apelido, senha }),
    });
    const dados = await resp.json();

    if (!resp.ok) {
      setErro(dados.erro ?? "Não deu pra entrar.");
      setEnviando(false);
      return;
    }

    // igual ao editor: sempre cai na home do papel, sem checar perfil
    // completo aqui — a própria página resolve o que mostrar
    router.push(dados.papel === "editor" ? "/editor" : "/porta-voz");
    router.refresh();
  }

  // atalhos de teste — o bundler remove este bloco no build de produção,
  // então nem chegam ao HTML que vai pro ar
  const atalhosDev =
    process.env.NODE_ENV === "development" ? (
      <div className="mb-6 rounded-xl border border-dashed border-line p-3">
        <p className="mb-2 text-center text-[11px] uppercase tracking-[0.1em] text-muted-2">
          Só em desenvolvimento
        </p>
        <div className="flex gap-2">
          <a
            href="/api/auth/dev-login?papel=editor"
            className="btn-ghost grid flex-1 place-items-center !py-2 text-xs"
          >
            Entrar como Editor
          </a>
          <a
            href="/api/auth/dev-login?papel=voz"
            className="btn-ghost grid flex-1 place-items-center !py-2 text-xs"
          >
            Entrar como Porta-voz
          </a>
          <a
            href="/api/auth/dev-login?papel=admin"
            className="btn-ghost grid flex-1 place-items-center !py-2 text-xs"
          >
            Entrar como Inspetor
          </a>
        </div>
      </div>
    ) : null;

  return (
    <div className="w-full max-w-sm">
      {atalhosDev}
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
          <path
            fill="#FBBC05"
            d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
          />
        </svg>
        Entrar com Google
      </a>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs uppercase tracking-[0.15em] text-muted-2">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label
            htmlFor="apelido"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Apelido
          </label>
          <div className="relative flex items-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-4 h-[17px] w-[17px] text-muted-2"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            <input
              id="apelido"
              name="apelido"
              className="field-input"
              placeholder="seu apelido"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={apelido}
              onChange={(e) => {
                setApelido(e.target.value);
                setErro("");
              }}
              aria-invalid={!!erro && !apelido.trim()}
            />
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="senha"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Senha
          </label>
          <div className="relative flex items-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-4 h-[17px] w-[17px] text-muted-2"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="senha"
              name="senha"
              type={showPw ? "text" : "password"}
              className="field-input pr-12"
              placeholder="sua senha"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro("");
              }}
              aria-invalid={!!erro && !senha}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-pressed={showPw}
              aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 grid h-11 w-11 place-items-center rounded-lg text-muted-2 transition-colors hover:bg-white/5 hover:text-silver"
            >
              {showPw ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-[18px] w-[18px]"
                  aria-hidden="true"
                >
                  <path d="M10.7 6.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.1M6.3 6.3A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9M3 3l18 18" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-[18px] w-[18px]"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* O quadradinho do checkbox nasce com 13px — menos de um terço do que
            um dedo acerta. Aumentar só ele deixaria desalinhado com o resto, e
            o padding no label resolve melhor: a área que responde ao toque
            passa a ser a frase inteira, não o quadrado. */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <label className="-ml-1 flex min-h-11 cursor-pointer select-none items-center gap-2 px-1 text-sm text-muted">
            <input type="checkbox" name="lembrar" className="h-4 w-4 accent-gold" />
            Manter conectado
          </label>
          <Link
            href="/recuperar"
            className="-mr-1 flex min-h-11 items-center px-1 text-sm text-muted hover:text-silver-hi"
          >
            Esqueci a senha
          </Link>
        </div>

        {erro && (
          <p role="alert" className="mb-4 text-center text-sm text-danger">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-gold" disabled={enviando}>
          {enviando ? "Abrindo os portões…" : "Entrar na Oficina Amarela"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Ainda não é membro?{" "}
        <Link href="/criar-conta" className="inline-block px-2 py-2 font-medium text-gold-hi hover:underline">
          Crie uma conta
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-muted-2">
        Ao entrar, você concorda com os{" "}
        <Link href="/termos" className="inline-block py-1.5 text-muted hover:text-silver-hi hover:underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="inline-block py-1.5 text-muted hover:text-silver-hi hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormConteudo />
    </Suspense>
  );
}
