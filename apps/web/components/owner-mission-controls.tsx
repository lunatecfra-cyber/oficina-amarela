"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type OwnerControls = {
  canCancel: boolean;
  canReassign: boolean;
  reassignAvailableAt: string | null;
  cancelled: boolean;
  version: number;
};

const ControlsContext = createContext<{
  controls: OwnerControls | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} | null>(null);

export function OwnerMissionProvider({
  id,
  children,
  loadOnMount = false,
}: {
  id: string;
  children: ReactNode;
  loadOnMount?: boolean;
}) {
  const [controls, setControls] = useState<OwnerControls | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const reload = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(id)}/owner-controls`, {
        cache: "no-store",
      });
      const data = await response.json();
      const c = data.controls;
      if (
        !response.ok ||
        data.ok !== true ||
        !c ||
        typeof c.canCancel !== "boolean" ||
        typeof c.canReassign !== "boolean" ||
        typeof c.cancelled !== "boolean" ||
        !Number.isInteger(c.version) ||
        !(c.reassignAvailableAt === null || typeof c.reassignAvailableAt === "string")
      ) {
        throw new Error("Não foi possível carregar as ações da missão.");
      }
      if (sequence === request.current) setControls(c);
    } catch {
      if (sequence === request.current) setError("Não foi possível carregar as ações da missão.");
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (loadOnMount) void reload();
    return () => {
      request.current++;
    };
  }, [loadOnMount, reload]);

  return (
    <ControlsContext.Provider value={{ controls, loading, error, reload }}>
      {children}
    </ControlsContext.Provider>
  );
}

export function useOwnerMissionControls() {
  return useContext(ControlsContext);
}

export function OwnerMissionActions({ id }: { id: string }) {
  const state = useOwnerMissionControls();
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"cancel_mission" | "reassign_mission" | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  // Keep the same key and payload after an uncertain response; edited intent gets a new key.
  const attempt = useRef<{ body: string; key: string } | null>(null);
  if (!state) throw new Error("OwnerMissionActions requires OwnerMissionProvider");
  const { controls, loading, error, reload } = state;
  const permitted =
    controls &&
    !controls.cancelled &&
    (action === "cancel_mission"
      ? controls.canCancel
      : action === "reassign_mission" && controls.canReassign);

  async function submit() {
    const trimmed = reason.trim();
    if (
      busy.current ||
      !permitted ||
      loading ||
      error ||
      !controls ||
      !action ||
      trimmed.length < 5 ||
      trimmed.length > 500
    )
      return;
    busy.current = true;
    setSending(true);
    setNotice("");
    try {
      const body = JSON.stringify({ action, reason: trimmed, version: controls.version });
      if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
      const response = await fetch(`/api/missions/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": attempt.current.key },
        body,
      });
      if (response.status === 409) {
        setNotice("A missão mudou. Confira as ações disponíveis e confirme novamente.");
        router.refresh();
        await reload();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setNotice(
          typeof data?.error === "string"
            ? data.error
            : "Não foi possível concluir. Tente novamente.",
        );
        return;
      }
      setNotice(
        action === "cancel_mission"
          ? "Missão cancelada."
          : "Missão devolvida à fila para um novo editor.",
      );
      setReason("");
      setAction(null);
      attempt.current = null;
      router.refresh();
      await reload();
    } catch {
      setNotice("Sem conexão. Seu motivo foi mantido; tente novamente.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <div className="min-w-0 py-2">
      <button
        type="button"
        className="min-h-11 text-sm text-muted hover:text-text"
        aria-expanded={open}
        aria-controls={formId}
        disabled={sending}
        onClick={() => {
          setOpen(!open);
          if (!open) void reload();
        }}
      >
        Ações da missão <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div id={formId} className="space-y-3 border-t border-line py-3">
          {loading && (
            <p role="status" className="text-sm text-muted">
              Carregando ações…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}{" "}
              <button
                type="button"
                className="underline"
                disabled={loading}
                onClick={() => void reload()}
              >
                Tentar novamente
              </button>
            </p>
          )}
          {controls?.cancelled && (
            <p className="text-sm text-muted">
              Missão cancelada. Histórico disponível para consulta.
            </p>
          )}
          {controls && !controls.cancelled && (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={loading || sending || !!error || !controls.canCancel}
                  onClick={() => {
                    setAction("cancel_mission");
                    setNotice("");
                  }}
                >
                  Cancelar missão
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={loading || sending || !!error || !controls.canReassign}
                  onClick={() => {
                    setAction("reassign_mission");
                    setNotice("");
                  }}
                >
                  Enviar para outro editor
                </button>
              </div>
              {!controls.canReassign && controls.reassignAvailableAt && (
                <p className="text-xs text-muted">
                  Troca disponível a partir de{" "}
                  {new Date(controls.reassignAvailableAt).toLocaleString("pt-BR")}. A troca só
                  ocorre após sua confirmação.
                </p>
              )}
            </>
          )}
          {action && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="space-y-3"
            >
              <p className="text-sm text-text">
                {action === "cancel_mission"
                  ? "Confirmar cancelamento? A missão será encerrada e a conversa ficará somente para leitura."
                  : "Ao confirmar, a missão voltará à fila e será oferecida a outro editor. Se ninguém estiver disponível, ela aguardará na fila."}
              </p>
              <label htmlFor={`${formId}-reason`} className="block text-sm text-muted">
                Motivo (5 a 500 caracteres)
              </label>
              <textarea
                id={`${formId}-reason`}
                className="field-input !pl-4 w-full"
                rows={3}
                minLength={5}
                maxLength={500}
                required
                value={reason}
                disabled={sending}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="btn-ghost"
                  disabled={
                    sending ||
                    loading ||
                    !!error ||
                    !permitted ||
                    reason.trim().length < 5 ||
                    reason.trim().length > 500
                  }
                >
                  {sending
                    ? "Enviando…"
                    : action === "cancel_mission"
                      ? "Confirmar cancelamento"
                      : "Confirmar volta à fila"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={sending}
                  onClick={() => setAction(null)}
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
          {notice && (
            <p role="status" className="text-sm text-text">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
