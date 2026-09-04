"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initials } from "@/lib/candidates";
import type { Role, Papel } from "@/lib/session";
import { mensagemDeErro } from "@/lib/api-errors";

type UserListItem = {
  id: number;
  handle: string;
  apelido?: string;
  name: string;
  nome?: string;
  email: string;
  role: Role | Papel;
  papel?: Role | Papel;
  banned: boolean;
  banido?: boolean;
  profileComplete: boolean;
  perfilCompleto?: boolean;
  createdAt: string;
  criadoEm?: string;
};

type UserDetail = UserListItem & {
  photoUrl: string | null;
  fotoUrl?: string | null;
  location: string | null;
  localizacao?: string | null;
  bio: string | null;
  deliveries: number;
  entregues?: number;
  reputation: number;
  reputacao?: number;
  streak: number;
  rating: number | null;
  nota?: number | null;
  politicalRole: string | null;
  cargo?: string | null;
  runningFor: string | null;
  disputaPor?: string | null;
  electionYear: string | null;
  anoEleicao?: string | null;
  bannedAt: string | null;
  banidoEm?: string | null;
  banReason: string | null;
  motivoBanimento?: string | null;
  activeMissions: number;
  pautasAtivas?: number;
};

const ROLE_LABELS: Record<string, string> = {
  spokesperson: "Porta-voz",
  voz: "Porta-voz",
  editor: "Editor",
  inspector: "Inspetor",
  admin: "Inspetor",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AccountsPanel() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/admin/users?q=${encodeURIComponent(term)}`);
      if (!resp.ok) {
        setError(mensagemDeErro(resp.status, "Busca falhou."));
        return;
      }
      const data = await resp.json();
      setResults(data.users ?? data.usuarios ?? []);
    } catch {
      setError("Sem conexão. Tenta de novo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers("");
  }, [fetchUsers]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchUsers(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchUsers]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Gerenciar Pessoas
          </h1>
          <p className="mt-1 text-sm text-muted">
            Veja contas, confirme porta-vozes e suspenda quem precisar.
          </p>
        </div>
      </div>

      <div className="mt-6" data-guia="busca-pessoas">
        <label htmlFor="busca-pessoas" className="sr-only">
          Buscar pessoas
        </label>
        <input
          id="busca-pessoas"
          type="search"
          autoComplete="off"
          className="field-input"
          placeholder="Buscar por nome, apelido ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="flex min-w-0 flex-col gap-2">
          {loading && results.length === 0 && (
            <li className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Carregando…
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Ninguém encontrado.
            </li>
          )}
          {results.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              active={selected?.id === u.id}
              onClick={() => void openDetail(u.id, setSelected, setError)}
            />
          ))}
        </ul>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <DetailPanel
              detail={selected}
              onUpdated={(updated) => setSelected(updated)}
              onDeleted={() => {
                setResults((list) => list.filter((u) => u.id !== selected.id));
                setSelected(null);
              }}
            />
          ) : (
            <div className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Selecione alguém pra ver a conta.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

async function openDetail(
  id: number,
  setDetail: (d: UserDetail | null) => void,
  setError: (m: string) => void
) {
  try {
    const resp = await fetch(`/api/admin/users/${id}`);
    if (!resp.ok) {
      setError(mensagemDeErro(resp.status, "Não deu pra abrir a conta."));
      return;
    }
    const data = await resp.json();
    setDetail(data.user ?? data.usuario);
    setError("");
  } catch {
    setError("Sem conexão. Tenta de novo.");
  }
}

function UserRow({
  user: u,
  active,
  onClick,
}: {
  user: UserListItem;
  active: boolean;
  onClick: () => void;
}) {
  const name = u.name ?? (u as any).nome;
  const handle = u.handle ?? (u as any).apelido;
  const role = u.role ?? (u as any).papel;
  const isBanned = u.banned ?? (u as any).banido;
  const isProfileComplete = u.profileComplete ?? (u as any).perfilCompleto;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors lg:p-4 ${
          active
            ? "border-gold/60 bg-gold/5"
            : "border-line bg-surface/70 hover:border-gold/30 hover:bg-surface"
        }`}
      >
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-ink-2 font-[family-name:var(--font-display)] text-sm font-semibold text-gold-hi">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-text">{name}</p>
            {isBanned && <BannedBadge />}
          </div>
          <p className="truncate text-xs text-muted">
            @{handle} · {u.email}
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-[11px] text-muted">
            {ROLE_LABELS[role] ?? role}
          </span>
          {!isProfileComplete && (
            <span className="text-[10px] text-muted-2">perfil incompleto</span>
          )}
        </div>
      </button>
    </li>
  );
}

function BannedBadge() {
  return (
    <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
      suspenso
    </span>
  );
}

function DetailPanel({
  detail: d,
  onUpdated,
  onDeleted,
}: {
  detail: UserDetail;
  onUpdated: (updated: UserDetail) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState<null | "ban" | "unban" | "delete">(null);
  const [reason, setReason] = useState("");
  const [typedHandle, setTypedHandle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [warning, setWarning] = useState("");

  const name = d.name ?? (d as any).nome;
  const handle = d.handle ?? (d as any).apelido;
  const role = d.role ?? (d as any).papel;
  const isBanned = d.banned ?? (d as any).banido;
  const location = d.location ?? (d as any).localizacao;
  const createdAt = d.createdAt ?? (d as any).criadoEm;
  const deliveries = d.deliveries ?? (d as any).entregues ?? 0;
  const reputation = d.reputation ?? (d as any).reputacao ?? 0;
  const streak = d.streak ?? 0;
  const rating = d.rating ?? (d as any).nota ?? null;
  const activeMissions = d.activeMissions ?? (d as any).pautasAtivas ?? 0;
  const politicalRole = d.politicalRole ?? (d as any).cargo;
  const runningFor = d.runningFor ?? (d as any).disputaPor;
  const electionYear = d.electionYear ?? (d as any).anoEleicao;
  const banReason = d.banReason ?? (d as any).motivoBanimento;
  const bannedAt = d.bannedAt ?? (d as any).banidoEm;

  const handleMatches =
    typedHandle.trim().toLowerCase() === handle.toLowerCase();

  async function handleConfirm() {
    if (confirming === "delete" && !handleMatches) {
      setWarning("Digite o apelido exatamente como aparece acima.");
      return;
    }
    setIsSaving(true);
    setWarning("");
    try {
      const resp = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: d.id,
          action: confirming === "ban" ? "ban" : confirming === "delete" ? "delete" : "unban",
          reason,
          acao: confirming === "ban" ? "banir" : confirming === "delete" ? "apagar" : "desbanir",
          motivo: reason,
        }),
      });
      if (!resp.ok) {
        setWarning(mensagemDeErro(resp.status, "Não deu pra concluir."));
        return;
      }

      if (confirming === "delete") {
        onDeleted();
        return;
      }

      const det = await fetch(`/api/admin/users/${d.id}`);
      if (det.ok) {
        const updated = await det.json();
        onUpdated(updated.user ?? updated.usuario);
      }
      setConfirming(null);
      setReason("");
    } catch {
      setWarning("Sem conexão. Tenta de novo.");
    } finally {
      setIsSaving(false);
    }
  }

  const isCandidate = (String(role) === "spokesperson" || String(role) === "voz") && (!!politicalRole || !!runningFor);
  const isAdmin = String(role) === "inspector" || String(role) === "admin" || String(role) === "inspetor";

  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-ink-2 font-[family-name:var(--font-display)] text-base font-semibold text-gold-hi">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {name}
            </h2>
            {isBanned && <BannedBadge />}
          </div>
          <p className="truncate text-xs text-muted">@{handle}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <DetailItem label="Papel" value={ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role} />
        <DetailItem label="E-mail" value={d.email} />
        {location && <DetailItem label="Região" value={location} />}
        <DetailItem label="Conta criada" value={formatDate(createdAt)} />
        {role === "editor" && (
          <>
            <DetailItem label="Entregues" value={String(deliveries)} />
            <DetailItem label="Reputação" value={String(reputation)} />
            <DetailItem label="Streak" value={String(streak)} />
            <DetailItem label="Nota" value={rating === null ? "—" : Number(rating).toFixed(2)} />
            <DetailItem label="Missões ativas" value={String(activeMissions)} />
          </>
        )}
        {isCandidate && (
          <>
            <DetailItem label="Cargo" value={politicalRole ?? ""} />
            {runningFor && <DetailItem label="Disputa" value={runningFor} />}
            {electionYear && <DetailItem label="Ano" value={electionYear} />}
          </>
        )}
        {(String(role) === "spokesperson" || String(role) === "voz") && !isCandidate && (
          <p className="rounded-lg border border-line-soft bg-ink-2/50 px-3 py-2 text-xs text-muted">
            Porta-voz sem perfil preenchido.
          </p>
        )}
      </dl>

      {isBanned && banReason && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-danger/80">Motivo da suspensão</p>
          <p className="mt-1 text-sm text-text">{banReason}</p>
          {bannedAt && (
            <p className="mt-1 text-xs text-muted">Desde {formatDate(bannedAt)}</p>
          )}
        </div>
      )}

      {warning && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {warning}
        </p>
      )}

      {!isAdmin && !confirming && (
        <div className="mt-5 flex gap-2">
          {isBanned ? (
            <button
              className="btn-gold flex-1"
              onClick={() => setConfirming("unban")}
              disabled={isSaving}
            >
              Desbanir
            </button>
          ) : (
            <button
              className="btn-ghost flex-1 !border-danger/40 !text-danger hover:!bg-danger/10"
              onClick={() => setConfirming("ban")}
              disabled={isSaving}
            >
              Banir
            </button>
          )}

          <button
            className="btn-ghost w-32 !text-muted-2 hover:!border-danger/40 hover:!text-danger"
            onClick={() => {
              setConfirming("delete");
              setTypedHandle("");
              setWarning("");
            }}
            disabled={isSaving}
          >
            Apagar
          </button>
        </div>
      )}

      {confirming === "delete" && (
        <div className="mt-5 rounded-xl border border-danger/40 bg-danger/[0.06] p-3">
          <p className="text-sm text-text">
            Apagar a conta de <b>{handle}</b> não tem volta. Some o cadastro,
            o histórico de entregas e a nota.
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Missão que essa pessoa tiver em mãos volta pra fila. O que já foi
            entregue e está em revisão continua com você.
          </p>
          <p className="mt-3 text-xs text-muted">
            Se for só afastar por um tempo, <b>Banir</b> resolve e dá pra desfazer.
          </p>

          <label
            htmlFor="confirmar-apelido"
            className="mt-3 mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            Digite {handle} pra confirmar
          </label>
          <input
            id="confirmar-apelido"
            className="field-input !pl-4"
            value={typedHandle}
            onChange={(e) => {
              setTypedHandle(e.target.value);
              setWarning("");
            }}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1 !border-danger/50 !text-danger hover:!bg-danger/10"
              onClick={handleConfirm}
              disabled={isSaving || !handleMatches}
            >
              {isSaving ? "Apagando…" : "Apagar pra sempre"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => {
                setConfirming(null);
                setTypedHandle("");
                setWarning("");
              }}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirming === "ban" && (
        <div className="mt-5 rounded-xl border border-line bg-ink-2/40 p-3">
          <label
            htmlFor="motivo-banimento"
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            Motivo da suspensão
          </label>
          <textarea
            id="motivo-banimento"
            className="field-input !pl-4 min-h-24 resize-y"
            placeholder="Por que suspender essa conta? (visível só ao inspetor)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <div className="mt-3 flex gap-2">
            <button
              className="btn-gold flex-1"
              onClick={handleConfirm}
              disabled={isSaving || !reason.trim()}
            >
              {isSaving ? "Suspensendo…" : "Confirmar suspensão"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => {
                setConfirming(null);
                setReason("");
              }}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirming === "unban" && (
        <div className="mt-5 rounded-xl border border-line bg-ink-2/40 p-3">
          <p className="text-sm text-text">
            Reabrir a conta de <strong>{name}</strong>? Ela volta a poder entrar.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-gold flex-1" onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? "Reabrindo…" : "Sim, desbanir"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => setConfirming(null)}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-2">{label}</dt>
      <dd className="text-right text-text">{value}</dd>
    </div>
  );
}

export { AccountsPanel as PainelContas };
