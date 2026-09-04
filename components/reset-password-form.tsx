"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { mensagemDeErro } from "@/lib/api-errors";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError("Link inválido — peça a recuperação de novo.");
      return;
    }
    if (password.length < 6) {
      setError("Senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    const resp = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, senha: password }),
    });
    setIsSubmitting(false);

    if (!resp.ok) {
      setError(mensagemDeErro(resp.status, "Não deu pra redefinir. Tenta pedir o link de novo."));
      return;
    }
    setIsSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-danger">Esse link está incompleto ou inválido.</p>
        <Link href="/recuperar" className="mt-6 inline-block text-sm font-medium text-gold-hi hover:underline">
          Pedir um novo link
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-[15px] text-muted">Senha alterada. Te levando pro login…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="password" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            className="field-input !pl-4"
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
          <label htmlFor="confirmPassword" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="field-input !pl-4"
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
          {isSubmitting ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

export { ResetPasswordForm as RedefinirSenhaForm };
