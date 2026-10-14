"use client";

import { ATTACHMENT_MAX_BYTES, validateChatAttachment } from "@oficina/domain/uploads";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Can = {
  statement: boolean;
  take: boolean;
  decide: boolean;
  appeal: boolean;
  close: boolean;
  evidence: boolean;
};

/** Sends a request and returns the API error message, or null on success. */
async function send(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ error: string | null; data: Record<string, unknown> | null }> {
  try {
    const isForm = body instanceof FormData;
    const resp = await fetch(path, {
      method,
      ...(isForm ? {} : { headers: { "Content-Type": "application/json" } }),
      ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
    });
    const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
    if (!resp.ok) return { error: String(data?.error ?? "Não deu pra concluir."), data };
    return { error: null, data };
  } catch {
    return { error: "Sem conexão. Tenta de novo.", data: null };
  }
}

function Form({
  title,
  submit,
  busy,
  error,
  onSubmit,
  children,
}: {
  title: string;
  submit: string;
  busy: boolean;
  error: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="rounded-2xl border border-line bg-surface/70 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn-gold mt-3 w-full sm:w-auto sm:px-6" disabled={busy}>
        {busy ? "Enviando…" : submit}
      </button>
    </form>
  );
}

export function NewDisputeForm({ missionId }: { missionId: number }) {
  const router = useRouter();
  const [category, setCategory] = useState("quality");
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const { error: failure, data } = await send("/api/disputes", "POST", {
      missionId,
      category,
      claim,
    });
    if (failure || typeof data?.id !== "number") {
      setError(failure ?? "Não deu pra abrir a disputa.");
      setBusy(false);
      return;
    }
    router.push(`/disputas/${data.id}`);
  }

  return (
    <Form
      title="Sobre o que é a disputa?"
      submit="Abrir disputa"
      busy={busy}
      error={error}
      onSubmit={submit}
    >
      <label className="text-sm text-muted" htmlFor="dispute-category">
        Assunto
        <select
          id="dispute-category"
          className="field-input !pl-4 mt-1"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="quality">Qualidade da entrega</option>
          <option value="deadline">Prazo</option>
          <option value="scope">Escopo do briefing</option>
          <option value="conduct">Conduta</option>
          <option value="other">Outro</option>
        </select>
      </label>
      <label className="text-sm text-muted" htmlFor="dispute-claim">
        O que aconteceu? (mínimo 10 caracteres)
        <textarea
          id="dispute-claim"
          className="field-input !pl-4 mt-1 min-h-28"
          maxLength={2000}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
      </label>
    </Form>
  );
}

export function DisputeActions({ id, can }: { id: number; can: Can }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState("upheld");
  const [rationale, setRationale] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [reason, setReason] = useState("");

  async function run(key: string, path: string, body?: unknown, after?: () => void) {
    setBusy(key);
    setError("");
    const { error: failure } = await send(`/api/disputes/${id}${path}`, "POST", body);
    setBusy("");
    if (failure) return setError(failure);
    after?.();
    router.refresh();
  }

  function pick(picked: File | null) {
    setError("");
    if (picked) {
      const policy = validateChatAttachment(picked.type, picked.size);
      if (!policy.ok) return setError(policy.error);
    }
    setFile(picked);
  }

  function statement() {
    const body = new FormData();
    body.set("text", text);
    if (file) body.set("file", file);
    // JSON when there is no file, so the simple path stays simple.
    void run("statement", "/statements", file ? body : { text }, () => {
      setText("");
      setFile(null);
    });
  }

  const any = Object.values(can).some(Boolean);
  if (!any) return null;
  return (
    <div className="mt-8 flex flex-col gap-4">
      {can.statement && (
        <Form
          title="Enviar manifestação"
          submit="Enviar"
          busy={busy === "statement"}
          error={error}
          onSubmit={statement}
        >
          <textarea
            aria-label="Manifestação"
            className="field-input !pl-4 min-h-24"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="text-xs text-muted">
            Anexar imagem ou PDF (até {ATTACHMENT_MAX_BYTES / 1024 ** 2} MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="mt-1 block text-xs"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        </Form>
      )}

      {can.take && (
        <div className="rounded-2xl border border-line bg-surface/70 p-4">
          <p className="text-sm text-muted">
            Ao assumir, você passa a ser a pessoa responsável por esta análise.
          </p>
          <button
            type="button"
            className="btn-gold mt-3 w-full sm:w-auto sm:px-6"
            disabled={busy === "take"}
            onClick={() => void run("take", "/take")}
          >
            Assumir a análise
          </button>
        </div>
      )}

      {can.decide && (
        <Form
          title="Registrar decisão"
          submit="Registrar decisão"
          busy={busy === "decision"}
          error={error}
          onSubmit={() => void run("decision", "/decision", { outcome, rationale, recommendation })}
        >
          <label className="text-sm text-muted">
            Resultado
            <select
              className="field-input !pl-4 mt-1"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="upheld">Procedente</option>
              <option value="partially_upheld">Parcialmente procedente</option>
              <option value="dismissed">Improcedente</option>
            </select>
          </label>
          <textarea
            aria-label="Fundamentação"
            placeholder="Fundamentação (mínimo 10 caracteres)"
            className="field-input !pl-4 min-h-24"
            maxLength={2000}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          <textarea
            aria-label="Recomendação"
            placeholder="Recomendação (opcional). Não é aplicada automaticamente."
            className="field-input !pl-4 min-h-16"
            maxLength={1000}
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          />
        </Form>
      )}

      {can.appeal && (
        <Form
          title="Pedir revisão da decisão"
          submit="Pedir revisão"
          busy={busy === "appeal"}
          error={error}
          onSubmit={() => void run("appeal", "/appeal", { reason })}
        >
          <textarea
            aria-label="Motivo do recurso"
            placeholder="Por que a decisão deve ser revista? (mínimo 10 caracteres)"
            className="field-input !pl-4 min-h-24"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Form>
      )}

      {can.close && (
        <Form
          title="Encerrar sem recurso"
          submit="Encerrar disputa"
          busy={busy === "close"}
          error={error}
          onSubmit={() => void run("close", "/close", { reason })}
        >
          <textarea
            aria-label="Justificativa do encerramento"
            placeholder="Justificativa (mínimo 10 caracteres)"
            className="field-input !pl-4 min-h-16"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Form>
      )}

      {can.evidence && (
        <a
          href={`/api/disputes/${id}/evidence`}
          className="text-sm text-gold-hi underline underline-offset-2"
        >
          Baixar o registro de evidências capturado na abertura
        </a>
      )}
    </div>
  );
}
