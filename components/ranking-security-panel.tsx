"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type View = "invitations" | "ranking" | "audit";
type Notice = { tone: "success" | "error"; text: string } | null;

type InvitationItem = {
  id: number;
  email: string;
  status: string;
  expira_em?: string;
  expires_at?: string;
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

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "invitations", label: "Convites de porta-voz" },
  { id: "ranking", label: "Ranking e constância" },
  { id: "audit", label: "Auditoria" },
];

const ACTION_LABELS: Record<string, string> = {
  aprovacao_anulada: "Aprovação anulada",
  bloqueio_concedido: "Bloqueio concedido",
  convite_criado: "Convite criado",
  convite_revogado: "Convite revogado",
  cancel_approval: "Aprovação anulada",
  grant_shield: "Bloqueio concedido",
};

const INVITATION_LABELS: Record<string, string> = {
  valido: "Válido",
  valid: "Válido",
  usado: "Usado",
  used: "Usado",
  expirado: "Expirado",
  expired: "Expirado",
  revogado: "Revogado",
  revoked: "Revogado",
};

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function invitationTone(status: string) {
  // paleta da casa: ouro, prata, preto e os dois sinais (ok/danger). Esmeralda
  // e azul-céu do Tailwind não pertencem à identidade e destoavam no escuro.
  if (status === "valido" || status === "valid") return "border-ok/40 bg-ok/10 text-ok";
  if (status === "usado" || status === "used") return "border-silver-lo/40 bg-surface-2 text-silver";
  if (status === "revogado" || status === "revoked") return "border-danger/30 bg-danger/10 text-danger";
  return "border-line-soft bg-surface text-muted";
}

export function RankingSecurityPanel() {
  const [view, setView] = useState<View>("invitations");
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    setInvitationError("");
    try {
      const res = await fetch("/api/admin/invitations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.erro ?? "Não foi possível carregar os convites.");
      setInvitations(data.invitations ?? data.convites ?? []);
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : "Não foi possível carregar os convites.");
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    setAuditError("");
    try {
      const res = await fetch("/api/admin/ranking");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.erro ?? "Não foi possível carregar a auditoria.");
      setAuditLogs(data.audit ?? data.auditoria ?? []);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "Não foi possível carregar a auditoria.");
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
    void loadAudit();
  }, [loadAudit, loadInvitations]);

  const filteredAudit = useMemo(() => {
    if (auditFilter === "all") return auditLogs;
    return auditLogs.filter((item) => item.acao === auditFilter);
  }, [auditFilter, auditLogs]);

  async function postAction(body: Record<string, unknown>, endpoint = "/api/admin/ranking") {
    setNotice(null);
    setLoadingAction(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "error", text: data.error ?? data.erro ?? "Não foi possível concluir a ação." });
        return { ok: false, data };
      }
      setNotice({ tone: "success", text: "Ação concluída e registrada na auditoria." });
      if (endpoint === "/api/admin/ranking") await loadAudit();
      return { ok: true, data };
    } catch {
      setNotice({ tone: "error", text: "Falha de conexão. Tente novamente." });
      return { ok: false, data: null };
    } finally {
      setLoadingAction(false);
    }
  }

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await postAction({ email }, "/api/admin/invitations");
    if (!result.ok) return;
    setLink(result.data.link ?? "");
    setEmail("");
    await loadInvitations();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setNotice({ tone: "success", text: "Link copiado. Envie manualmente ao porta-voz." });
    } catch {
      setNotice({ tone: "error", text: "Não foi possível copiar automaticamente. Selecione o link e copie." });
    }
  }

  async function revokeInvitation(invitation: InvitationItem) {
    if (!window.confirm(`Revogar o convite enviado para ${invitation.email}? Esta ação não pode ser desfeita.`)) return;
    const result = await postAction({ action: "revoke", id: invitation.id }, "/api/admin/invitations");
    if (result.ok) await loadInvitations();
  }

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text">Painel operacional</p>
          <p className="mt-1 text-sm text-muted">Convites, correções e registros do ciclo eleitoral.</p>
        </div>
        <div className="flex overflow-x-auto rounded-lg border border-line bg-surface p-1" role="tablist" aria-label="Visualizações do painel">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              /* `text-bg` não existe no tema (não há --color-bg): a aba ativa
                 saía branca sobre branca, ilegível. `text-ink` é o preto do
                 fundo — o contraste certo contra `bg-text`. */
              className={`flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm transition-colors ${view === item.id ? "bg-text font-medium text-ink" : "text-muted hover:text-text"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p role="status" className={`mt-4 border-l-2 px-3 py-2 text-sm ${notice.tone === "success" ? "border-ok text-ok" : "border-danger text-danger"}`}>{notice.text}</p>}

      {view === "invitations" && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="border border-line bg-surface/60 p-4">
            <h2 className="text-sm font-semibold text-text">Gerar convite</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Uso único, vinculado ao e-mail e válido por 7 dias.</p>
            <form className="mt-4 grid gap-3" onSubmit={createInvitation}>
              <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="invitation-email">
                E-mail do porta-voz
                <input id="invitation-email" type="email" required className="field-input" placeholder="email@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <button className="btn-gold w-full" type="submit" disabled={loadingAction}>{loadingAction ? "Gerando..." : "Gerar convite"}</button>
            </form>
            {link && (
              <div className="mt-5 border-t border-line-soft pt-4">
                <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="invitation-link">
                  Último link criado
                  <input id="invitation-link" readOnly className="field-input" value={link} onFocus={(event) => event.currentTarget.select()} />
                </label>
                <button type="button" className="btn-ghost mt-2 w-full" onClick={copyLink}>Copiar link</button>
              </div>
            )}
          </section>

          <section className="border border-line bg-surface/60">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Convites emitidos</h2>
              <button type="button" className="link-toque -mr-3 text-xs text-muted hover:text-text" onClick={() => void loadInvitations()}>Atualizar</button>
            </div>
            {loadingInvitations ? <PanelState text="Carregando convites..." /> : invitationError ? <PanelState text={invitationError} error /> : invitations.length === 0 ? <PanelState text="Nenhum convite emitido ainda." /> : (
              <ul className="divide-y divide-line-soft">
                {invitations.map((invitation) => {
                  const status = invitation.status.toLowerCase();
                  return (
                    <li key={invitation.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{invitation.email}</p>
                        <p className="mt-0.5 text-xs text-muted">Expira em {formatDateTime(invitation.expires_at ?? invitation.expira_em)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${invitationTone(status)}`}>{INVITATION_LABELS[status] ?? invitation.status}</span>
                        {(status === "valido" || status === "valid") && <button type="button" className="text-xs text-danger hover:underline" onClick={() => void revokeInvitation(invitation)} disabled={loadingAction}>Revogar</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {view === "ranking" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <OperationForm
            title="Conceder bloqueio"
            description="Segura uma semana falhada em vez de zerar a sequência do editor."
            idLabel="ID do editor"
            action="grant_shield"
            idKey="editorId"
            buttonLabel="Conceder bloqueio"
            limite="Teto de 2 por editor — acima disso o pedido é recusado."
            loading={loadingAction}
            onSubmit={postAction}
          />
          <OperationForm
            title="Anular aprovação"
            description="Remove a aprovação da missão do ciclo eleitoral."
            idLabel="ID da missão"
            action="cancel_approval"
            idKey="missionId"
            buttonLabel="Anular aprovação"
            limite="Recalcula posição no ranking, sequência de constância, nota, XP e pontos de quem indicou o editor. Não há desfazer."
            dangerous
            loading={loadingAction}
            onSubmit={postAction}
          />
        </div>
      )}

      {view === "audit" && (
        <section className="mt-5 border border-line bg-surface/60">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text">Linha do tempo</h2>
              <p className="mt-0.5 text-xs text-muted">Ações administrativas registradas no ciclo.</p>
            </div>
            <div className="flex gap-2">
              {/* uma opção por tipo de ação: o banco grava sempre em pt-BR
                  (`aprovacao_anulada`, `bloqueio_concedido`, `convite_*`), e
                  duas linhas com o mesmo rótulo só confundiam quem filtra */}
              <select className="field-input !pl-3 min-h-11 py-1 text-sm" value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} aria-label="Filtrar auditoria">
                <option value="all">Todas as ações</option>
                <option value="aprovacao_anulada">Aprovações anuladas</option>
                <option value="bloqueio_concedido">Bloqueios concedidos</option>
                <option value="convite_criado">Convites criados</option>
                <option value="convite_revogado">Convites revogados</option>
              </select>
              <button type="button" className="btn-ghost min-h-11 w-auto px-3 text-xs" onClick={() => void loadAudit()}>Atualizar</button>
            </div>
          </div>
          {loadingAudit ? <PanelState text="Carregando auditoria..." /> : auditError ? <PanelState text={auditError} error /> : filteredAudit.length === 0 ? <PanelState text="Nenhum registro para este filtro." /> : (
            <ol className="divide-y divide-line-soft">
              {filteredAudit.map((log) => (
                <li key={log.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{ACTION_LABELS[log.acao] ?? log.acao}</p>
                    <p className="mt-0.5 text-xs text-muted">{log.ator_nome ?? "Sistema"} · {log.entidade} #{log.entidade_id}</p>
                    {(log.detalhes?.motivo || log.detalhes?.reason) && <p className="mt-1 text-xs text-muted-2">Motivo: {log.detalhes.motivo ?? log.detalhes.reason}</p>}
                  </div>
                  <time className="text-xs text-muted-2" dateTime={log.criado_em}>{formatDateTime(log.criado_em)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}

function PanelState({ text, error = false }: { text: string; error?: boolean }) {
  return <p className={`px-4 py-8 text-center text-sm ${error ? "text-danger" : "text-muted"}`}>{text}</p>;
}

function OperationForm({ title, description, idLabel, idKey, action, buttonLabel, limite, dangerous = false, loading, onSubmit }: {
  title: string;
  description: string;
  idLabel: string;
  idKey: "missionId" | "editorId";
  action: "cancel_approval" | "grant_shield";
  buttonLabel: string;
  /** o que a ação custa: o teto de 2, ou o estrago que a anulação faz */
  limite: string;
  dangerous?: boolean;
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<{ ok: boolean }>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const isConfirmed = !dangerous || confirmation === "ANULAR";

  return (
    <form className={`border p-4 ${dangerous ? "border-danger/40 bg-danger/[0.03]" : "border-line bg-surface/60"}`} onSubmit={async (event) => {
      event.preventDefault();
      if (!isConfirmed) return;
      // guarda o form ANTES do await: `event.currentTarget` já vem null do
      // outro lado, e o `.reset()` estourava depois de toda ação bem-sucedida
      // — o formulário ficava preenchido e o erro caía no console
      const form = event.currentTarget;
      const data = new FormData(form);
      const result = await onSubmit({ action, [idKey]: Number(data.get("id")), reason: data.get("reason"), motivo: data.get("reason") });
      if (result.ok) {
        form.reset();
        setConfirmation("");
      }
    }}>
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>

      {/* consequência sempre à vista, antes dos campos: quem opera precisa
          saber o que a ação move ANTES de digitar o ID */}
      <p className={`mt-3 flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-5 ${dangerous ? "border-danger/40 bg-danger/[0.06] text-danger" : "border-line-soft text-muted-2"}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" strokeLinecap="round" />
          <path d="M12 16.2v.2" strokeLinecap="round" />
        </svg>
        {limite}
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs font-medium text-muted">{idLabel}<input name="id" type="number" min="1" required className="field-input" /></label>
        <label className="grid gap-1.5 text-xs font-medium text-muted">Motivo obrigatório<textarea name="reason" required rows={3} className="field-input resize-y" placeholder="Registre a justificativa desta ação." /></label>
        {dangerous && <label className="grid gap-1.5 text-xs font-medium text-danger">Confirmação forte: digite ANULAR<input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} className="field-input" placeholder="ANULAR" /></label>}
        <button type="submit" className={dangerous ? "btn-ghost !border-danger/50 !text-danger hover:!bg-danger/10" : "btn-ghost"} disabled={loading || !isConfirmed}>{loading ? "Processando..." : buttonLabel}</button>
      </div>
    </form>
  );
}

export const SegurancaRankingPainel = RankingSecurityPanel;
