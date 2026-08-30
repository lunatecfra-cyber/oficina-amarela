"use client";

import { useCallback, useEffect, useState } from "react";

type InvitationItem = {
  id: number;
  email: string;
  status: string;
  expiresAt: string;
};

type AuditEvent = {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes: { motivo?: string; reason?: string } | null;
  criado_em: string;
  ator_nome: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  aprovacao_anulada: "Anulou aprovação",
  bloqueio_concedido: "Concedeu bloqueio",
  cancel_approval: "Anulou aprovação",
  grant_shield: "Concedeu bloqueio",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RankingSecurityPanel() {
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");

  const loadInvitations = useCallback(async () => {
    const res = await fetch("/api/admin/invitations");
    if (res.ok) {
      const data = await res.json();
      setInvitations(data.invitations ?? data.convites ?? []);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/admin/ranking");
    if (res.ok) {
      const data = await res.json();
      setAuditLogs(data.audit ?? data.auditoria ?? []);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      await loadInvitations();
      await loadAudit();
    }
    void loadInitial();
  }, [loadInvitations, loadAudit]);

  async function postAction(body: Record<string, unknown>, endpoint = "/api/admin/ranking") {
    setMessage("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setMessage(
      res.ok ? "Ação concluída." : (data.error ?? data.erro ?? "Não foi possível concluir."),
    );
    if (res.ok && endpoint === "/api/admin/ranking") await loadAudit();
    return { res, data };
  }

  async function handleCreateInvitation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { res, data } = await postAction({ email }, "/api/admin/invitations");
    if (res.ok) {
      setLink(data.link);
      setEmail("");
      await loadInvitations();
    }
  }

  return (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface/60 p-5">
          <h2 className="font-semibold text-text">Convite de porta-voz</h2>
          <form onSubmit={handleCreateInvitation} className="mt-4 flex gap-2">
            <input
              type="email"
              required
              className="field-input"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-gold w-auto px-4" type="submit">
              Gerar
            </button>
          </form>
          {link && (
            <div className="mt-3">
              <label htmlFor="link-convite" className="text-xs text-muted">
                Link para envio manual
              </label>
              <input
                id="link-convite"
                readOnly
                className="field-input mt-1"
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
          <ul className="mt-5 space-y-2 text-sm">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 border-t border-line-soft pt-2"
              >
                <span className="min-w-0 truncate text-muted">
                  {invitation.email} · {invitation.status}
                </span>
                {invitation.status === "valido" && (
                  <button
                    className="text-xs text-danger hover:underline"
                    onClick={async () => {
                      await postAction(
                        { action: "revoke", id: invitation.id },
                        "/api/admin/invitations",
                      );
                      await loadInvitations();
                    }}
                  >
                    Revogar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface/60 p-5">
          <h2 className="font-semibold text-text">Correções e bloqueios</h2>
          <ActionForm
            title="Anular aprovação"
            field="missionId"
            placeholder="ID da missão"
            action="cancel_approval"
            onSubmit={postAction}
          />
          <ActionForm
            title="Conceder bloqueio"
            field="editorId"
            placeholder="ID do editor"
            action="grant_shield"
            onSubmit={postAction}
          />
          {message && (
            <p role="status" className="mt-4 text-sm text-muted">
              {message}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface/60 p-5">
        <h2 className="font-semibold text-text">Auditoria</h2>
        {auditLogs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-2">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1 border-t border-line-soft pt-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-text">
                    {ACTION_LABELS[log.acao] ?? log.acao}
                    <span className="text-muted-2">
                      {" "}
                      · {log.entidade} #{log.entidade_id}
                    </span>
                  </span>
                  <span className="text-xs text-muted-2">{formatDateTime(log.criado_em)}</span>
                </div>
                <p className="text-xs text-muted">
                  {log.ator_nome ?? "—"}
                  {(log.detalhes?.motivo || log.detalhes?.reason) && (
                    <> · {log.detalhes.motivo || log.detalhes.reason}</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ActionForm({
  title,
  field,
  placeholder,
  action,
  onSubmit,
}: {
  title: string;
  field: "missionId" | "editorId";
  placeholder: string;
  action: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <form
      className="mt-4 grid gap-2 border-t border-line-soft pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await onSubmit({
          action,
          acao: action,
          [field]: Number(data.get("id")),
          reason: data.get("motivo"),
          motivo: data.get("motivo"),
        });
        e.currentTarget.reset();
      }}
    >
      <p className="text-sm font-medium text-text">{title}</p>
      <input
        name="id"
        type="number"
        min="1"
        required
        className="field-input"
        placeholder={placeholder}
      />
      <input name="motivo" required className="field-input" placeholder="Motivo obrigatório" />
      <button type="submit" className="btn-ghost">
        Confirmar
      </button>
    </form>
  );
}

export const SegurancaRankingPainel = RankingSecurityPanel;
