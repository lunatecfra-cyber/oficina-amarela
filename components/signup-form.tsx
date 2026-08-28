"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type SlotsInfo = {
  editor: { total: number; enrolled?: number; inscritos?: number; free?: number; livres?: number };
  spokesperson?: { total: number; enrolled?: number; inscritos?: number; free?: number; livres?: number };
  voz?: { total: number; enrolled?: number; inscritos?: number; free?: number; livres?: number };
};

export function SignupForm({
  devMode = false,
  modoDev = false,
}: {
  devMode?: boolean;
  modoDev?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"spokesperson" | "editor">(() => {
    const raw = searchParams.get("role") ?? searchParams.get("papel");
    return raw === "editor" ? "editor" : "spokesperson";
  });
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slots, setSlots] = useState<SlotsInfo | null>(null);

  const isDev = devMode || modoDev;

  useEffect(() => {
    fetch("/api/slots")
      .then((r) => r.json())
      .then((d: SlotsInfo) => setSlots(d))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !handle.trim() || !email.trim() || !password) {
      setError("Preencha nome, apelido, e-mail e senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    const resp = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        handle,
        email,
        password,
        role,
        nome: name,
        apelido: handle,
        senha: password,
        papel: role === "spokesperson" ? "voz" : "editor",
      }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      setError(data.error ?? data.erro ?? "Não deu pra criar a conta.");
      setIsSubmitting(false);
      return;
    }

    router.push(role === "editor" ? "/editor/create-profile" : "/spokesperson/create-profile");
    router.refresh();
  }

  const editorFree = slots?.editor?.free ?? slots?.editor?.livres ?? 0;
  const editorEnrolled = slots?.editor?.enrolled ?? slots?.editor?.inscritos ?? 0;
  const editorTotal = slots?.editor?.total ?? 0;

  const spokespersonObj = slots?.spokesperson ?? slots?.voz;
  const voiceFree = spokespersonObj?.free ?? spokespersonObj?.livres ?? 0;
  const voiceEnrolled = spokespersonObj?.enrolled ?? spokespersonObj?.inscritos ?? 0;
  const voiceTotal = spokespersonObj?.total ?? 0;

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
          onClick={() => setRole("spokesperson")}
          className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            role === "spokesperson" ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
          }`}
        >
          Sou porta-voz
        </button>
        <button
          type="button"
          onClick={() => setRole("editor")}
          className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            role === "editor" ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
          }`}
        >
          Sou editor
        </button>
      </div>

      {isDev && (
        <div className="mb-6 rounded-xl border border-gold-lo/30 bg-gold/[0.05] p-4">
          <p className="text-xs leading-relaxed text-muted">
            Ambiente local: veja a área de demonstração sem preencher cadastro.
          </p>
          <a
            href={`/api/auth/dev-login?role=${role}&destination=profile`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-gold-hi transition-colors hover:bg-gold/10 hover:text-gold"
          >
            Criar perfil de demonstração como {role === "spokesperson" ? "porta-voz" : "editor"}
          </a>
          <Link
            href="/signup"
            className="mt-3 block text-center text-xs text-muted-2 transition-colors hover:text-text"
          >
            ← voltar para escolher o papel
          </Link>
        </div>
      )}

      {slots && (
        <p className="mb-4 text-center text-xs text-muted-2">
          {role === "editor" ? (
            <>
              {editorFree === 0 ? (
                <span className="text-danger">Sem vagas de editor no momento.</span>
              ) : (
                <>
                  <span className="font-semibold text-gold">{editorFree}</span> vaga
                  {editorFree !== 1 ? "s" : ""} de editor{" "}
                  <span className="text-muted-2">
                    ({editorEnrolled}/{editorTotal})
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              {voiceFree === 0 ? (
                <span className="text-danger">Sem vagas de candidato no momento.</span>
              ) : (
                <>
                  <span className="font-semibold text-gold">{voiceFree}</span> vaga
                  {voiceFree !== 1 ? "s" : ""} de candidato{" "}
                  <span className="text-muted-2">
                    ({voiceEnrolled}/{voiceTotal})
                  </span>
                </>
              )}
            </>
          )}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="name" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Nome
          </label>
          <input
            id="name"
            name="name"
            className="field-input"
            placeholder="seu nome"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="handle"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Apelido
          </label>
          <input
            id="handle"
            name="handle"
            className="field-input"
            placeholder="ex: jr.eneias"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setError("");
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
              setError("");
            }}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field-input"
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="mb-5">
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
          >
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="field-input"
            placeholder="repita a senha"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
          />
        </div>

        {error && (
          <p role="alert" className="mb-4 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn-gold" disabled={isSubmitting}>
          {isSubmitting ? "Criando conta…" : "Criar minha conta"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted-2">
        Ao criar sua conta você concorda com os{" "}
        <Link href="/terms" className="inline-block py-1.5 text-muted hover:text-gold-hi hover:underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacy" className="inline-block py-1.5 text-muted hover:text-gold-hi hover:underline">
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

export { SignupForm as CriarContaForm };
