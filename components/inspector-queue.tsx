"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MissionChat } from "@/components/mission-chat";
import { Badge, Chip, candidateOfMission } from "@/components/mission-ui";
import { ProximityLocation } from "@/components/proximity-location";
import { type Candidate, type Candidato, initials } from "@/lib/candidates";
import type { Mensagem, Message } from "@/lib/chat-db";
import { FORMAT_LABELS, MISSIONS, type Mission, type Pauta } from "@/lib/missions";
import { looksLikeLink } from "@/lib/validators";

export function InspectorQueue({
  realMissions = [],
  candidatesByHandle = {},
  messagesByMission = {},
  // compatibility aliases
  pautasReais,
  candidatosPorApelido,
  mensagensPorPauta,
}: {
  realMissions?: Mission[] | Pauta[];
  candidatesByHandle?: Record<string, Candidate | Candidato>;
  messagesByMission?: Record<number, Message[] | Mensagem[]>;
  pautasReais?: Mission[] | Pauta[];
  candidatosPorApelido?: Record<string, Candidate | Candidato>;
  mensagensPorPauta?: Record<number, Message[] | Mensagem[]>;
}) {
  const router = useRouter();

  const realList = (pautasReais ?? realMissions) as Mission[];
  const candidatesMap = (candidatosPorApelido ?? candidatesByHandle) as Record<string, Candidate>;
  const messagesMap = (mensagensPorPauta ?? messagesByMission) as Record<number, Message[]>;

  const demo = process.env.NODE_ENV !== "production" ? MISSIONS : [];
  const [missions, setMissions] = useState<Mission[]>([...realList, ...demo]);
  const [error, setError] = useState("");

  const inReview = missions.filter(
    (p) => p.status === "in_review" || (p as any).status === "em_revisao",
  );

  const isRealMission = (id: string) => id.startsWith("db-");

  async function callApi(id: string, body: Record<string, unknown>): Promise<boolean> {
    const resp = await fetch(`/api/missions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setError(data?.error ?? data?.erro ?? "Não deu pra concluir. Tenta de novo.");
      return false;
    }
    setError("");
    return true;
  }

  async function approve(id: string, rating?: number) {
    if (
      isRealMission(id) &&
      !(await callApi(id, { action: "approve", rating, acao: "aprovar", nota: rating }))
    )
      return;

    setMissions((list) =>
      list.map((p) => (p.id === id ? { ...p, status: "approved", inspectorNotes: undefined } : p)),
    );
    router.refresh();
  }

  async function requestReedit(id: string, notes: string) {
    if (
      isRealMission(id) &&
      !(await callApi(id, { action: "reedit", notes, acao: "reedicao", notas: notes }))
    )
      return;

    setMissions((list) =>
      list.map((p) => (p.id === id ? { ...p, status: "reedit", inspectorNotes: notes } : p)),
    );
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Controle de Qualidade
          </h1>
          <p className="mt-1 text-sm text-muted">Aprove ou peça reedição das missões entregues.</p>
        </div>
        <p className="text-sm text-muted">{inReview.length} aguardando</p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {inReview.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line-soft bg-surface/40 p-10 text-center text-sm text-muted">
          Nada pra revisar agora.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {inReview.map((p) => (
            <ReviewCard
              key={p.id}
              mission={p}
              onApprove={(stars) => approve(p.id, stars)}
              onRequestReedit={(notes) => requestReedit(p.id, notes)}
              candidatesByHandle={candidatesMap}
              messages={messagesMap[Number(p.id.replace(/^db-/, ""))] ?? []}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({
  mission: p,
  onApprove,
  onRequestReedit,
  candidatesByHandle = {},
  messages = [],
}: {
  mission: Mission;
  onApprove: (stars?: number) => void;
  onRequestReedit: (notes: string) => void;
  candidatesByHandle?: Record<string, Candidate>;
  messages?: Message[];
}) {
  const [isReeditOpen, setIsReeditOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [stars, setStars] = useState<number | undefined>(undefined);
  const [warning, setWarning] = useState("");
  const cand = candidateOfMission(p, candidatesByHandle);

  function handleConfirmReedit() {
    if (!notes.trim()) {
      setWarning("Escreve o que precisa mudar antes de devolver.");
      return;
    }
    onRequestReedit(notes.trim());
  }

  const title = p.title ?? (p as any).titulo;
  const status = p.status;
  const format = p.format ?? (p as any).formato;
  const reservedBy = p.reservedBy ?? (p as any).reservadaPor;
  const deliveryLink = p.deliveryLink ?? (p as any).entregaLink;
  const brief = p.brief ?? {};
  const tone = brief.tone ?? (brief as any).tom;
  const color = brief.color ?? (brief as any).cor;
  const font = brief.font ?? (brief as any).fonte;
  const refs = brief.refs;

  return (
    <li className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Link
          href={`/candidate/${cand.slug}`}
          className="group flex flex-none items-center gap-3 lg:w-56"
        >
          <span
            className="grid h-12 w-12 flex-none place-items-center rounded-xl font-[family-name:var(--font-display)] text-sm font-semibold text-black/80"
            style={{ background: cand.tint }}
          >
            {initials(cand.name ?? (cand as any).nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-text transition-colors group-hover:text-gold-hi">
              {cand.name ?? (cand as any).nome}
            </p>
            <p className="truncate text-xs text-muted">{cand.role ?? (cand as any).cargo}</p>
            <ProximityLocation
              location={cand.location ?? (cand as any).local}
              proximity={cand.proximity ?? (cand as any).proximidade ?? 0}
              className="text-xs text-muted-2"
            />
          </div>
        </Link>

        <div className="min-w-0 flex-1 lg:border-l lg:border-line lg:pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {title}
            </h3>
            <Badge status={status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-muted">
              {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}
            </span>
            {tone && <Chip k="tom" v={tone} />}
            {color && <Chip k="cor" v={color} />}
            {font && <Chip k="fonte" v={font} />}
            {refs && <Chip k="ref" v={refs} />}
          </div>
          <p className="mt-2 text-xs text-muted">
            Entregue por <span className="text-text">{reservedBy}</span>
            {deliveryLink && looksLikeLink(deliveryLink) && (
              <>
                {" "}
                ·{" "}
                <a
                  href={deliveryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold-hi hover:underline"
                >
                  Abrir vídeo entregue
                </a>
              </>
            )}
            {" · "}
            <button
              type="button"
              onClick={() => setIsChatOpen((v) => !v)}
              className="font-medium text-gold-hi hover:underline"
            >
              💬 Conversa ({messages.length})
            </button>
          </p>
        </div>

        {isChatOpen && (
          <div className="mt-4">
            <MissionChat missionId={p.id} messages={messages} compact />
          </div>
        )}

        {!isReeditOpen && (
          <div className="flex flex-none flex-col gap-2 lg:w-56">
            <div className="flex items-center justify-center gap-1" data-guia="nota-editor">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Dar nota ${n}`}
                  aria-pressed={stars === n}
                  onClick={() => setStars(n)}
                  className={`grid h-11 w-11 place-items-center text-lg leading-none transition-opacity lg:h-auto lg:w-auto ${
                    stars && n <= stars ? "opacity-100" : "opacity-30 hover:opacity-60"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:flex-col" data-guia="decisao-inspetor">
              <button
                className="btn-gold flex-1 whitespace-nowrap"
                onClick={() => onApprove(stars)}
              >
                Aprovar
              </button>
              <button
                className="btn-ghost flex-1 whitespace-nowrap"
                onClick={() => setIsReeditOpen(true)}
              >
                Pedir reedição
              </button>
            </div>
          </div>
        )}
      </div>

      {isReeditOpen && (
        <div className="mt-4 rounded-xl border border-line bg-surface/60 p-4">
          <label
            htmlFor={`nota-${p.id}`}
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            O que precisa mudar
          </label>
          <textarea
            id={`nota-${p.id}`}
            className="field-input !pl-4 min-h-24 resize-y"
            placeholder="ex.: cortar os 10s iniciais, trocar a trilha, ajustar a legenda..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setWarning("");
            }}
          />
          {warning && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {warning}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={handleConfirmReedit}>
              Confirmar reedição
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setIsReeditOpen(false);
                setNotes("");
                setWarning("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export { InspectorQueue as FilaInspetor };
