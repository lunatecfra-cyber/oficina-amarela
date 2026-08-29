"use client";

import { useCallback, useEffect, useState } from "react";

type Convite = {
  id: number;
  email: string;
  status: string;
  expira_em: string;
};

type EventoAuditoria = {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: string;
  detalhes: { motivo?: string } | null;
  criado_em: string;
  ator_nome: string | null;
};

const ROTULO_ACAO: Record<string, string> = {
  aprovacao_anulada: "Anulou aprovação",
  bloqueio_concedido: "Concedeu bloqueio",
};

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SegurancaRankingPainel() {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [auditoria, setAuditoria] = useState<EventoAuditoria[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async () => {
    const resposta = await fetch("/api/admin/convites");
    if (resposta.ok) setConvites((await resposta.json()).convites);
  }, []);

  const carregarAuditoria = useCallback(async () => {
    const resposta = await fetch("/api/admin/ranking");
    if (resposta.ok) setAuditoria((await resposta.json()).auditoria);
  }, []);

  useEffect(() => {
    async function carregarInicial() {
      await carregar();
      await carregarAuditoria();
    }
    void carregarInicial();
  }, [carregar, carregarAuditoria]);

  async function enviar(body: Record<string, unknown>, rota = "/api/admin/ranking") {
    setMensagem("");
    const resposta = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const dados = await resposta.json();
    setMensagem(resposta.ok ? "Ação concluída." : dados.erro ?? "Não foi possível concluir.");
    if (resposta.ok && rota === "/api/admin/ranking") await carregarAuditoria();
    return { resposta, dados };
  }

  async function criarConvite(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { resposta, dados } = await enviar({ email }, "/api/admin/convites");
    if (resposta.ok) {
      setLink(dados.link);
      setEmail("");
      await carregar();
    }
  }

  return (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface/60 p-5">
          <h2 className="font-semibold text-text">Convite de porta-voz</h2>
          <form onSubmit={criarConvite} className="mt-4 flex gap-2">
            <input
              type="email"
              required
              className="field-input"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
            />
            <button className="btn-gold w-auto px-4" type="submit">Gerar</button>
          </form>
          {link && (
            <div className="mt-3">
              <label htmlFor="link-convite" className="text-xs text-muted">Link para envio manual</label>
              <input id="link-convite" readOnly className="field-input mt-1" value={link} onFocus={(e) => e.currentTarget.select()} />
            </div>
          )}
          <ul className="mt-5 space-y-2 text-sm">
            {convites.map((convite) => (
              <li key={convite.id} className="flex items-center justify-between gap-3 border-t border-line-soft pt-2">
                <span className="min-w-0 truncate text-muted">{convite.email} · {convite.status}</span>
                {convite.status === "valido" && (
                  <button
                    className="text-xs text-danger hover:underline"
                    onClick={async () => {
                      await enviar({ acao: "revogar", id: convite.id }, "/api/admin/convites");
                      await carregar();
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
          <AcaoForm
            titulo="Anular aprovação"
            campo="pautaId"
            placeholder="ID da missão"
            acao="anular_aprovacao"
            enviar={enviar}
          />
          <AcaoForm
            titulo="Conceder bloqueio"
            campo="editorId"
            placeholder="ID do editor"
            acao="conceder_bloqueio"
            enviar={enviar}
          />
          {mensagem && <p role="status" className="mt-4 text-sm text-muted">{mensagem}</p>}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface/60 p-5">
        <h2 className="font-semibold text-text">Auditoria</h2>
        {auditoria.length === 0 ? (
          <p className="mt-3 text-sm text-muted-2">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {auditoria.map((evento) => (
              <li key={evento.id} className="flex flex-col gap-1 border-t border-line-soft pt-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-text">
                    {ROTULO_ACAO[evento.acao] ?? evento.acao}
                    <span className="text-muted-2"> · {evento.entidade} #{evento.entidade_id}</span>
                  </span>
                  <span className="text-xs text-muted-2">{dataHora(evento.criado_em)}</span>
                </div>
                <p className="text-xs text-muted">
                  {evento.ator_nome ?? "—"}
                  {evento.detalhes?.motivo && <> · {evento.detalhes.motivo}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AcaoForm({
  titulo,
  campo,
  placeholder,
  acao,
  enviar,
}: {
  titulo: string;
  campo: "pautaId" | "editorId";
  placeholder: string;
  acao: string;
  enviar: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <form
      className="mt-4 grid gap-2 border-t border-line-soft pt-4"
      onSubmit={async (evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        await enviar({ acao, [campo]: Number(dados.get("id")), motivo: dados.get("motivo") });
        evento.currentTarget.reset();
      }}
    >
      <p className="text-sm font-medium text-text">{titulo}</p>
      <input name="id" type="number" min="1" required className="field-input" placeholder={placeholder} />
      <input name="motivo" required className="field-input" placeholder="Motivo obrigatório" />
      <button type="submit" className="btn-ghost">Confirmar</button>
    </form>
  );
}
