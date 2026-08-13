"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { pareceLink, pareceLinkDrive } from "@/lib/validators";

// A missão que o editor aceitou e está fazendo agora.
//
// Vivia dentro de fila-pautas.tsx, junto da lista de missões disponíveis.
// Com o dispatch, o editor não navega mais por lista nenhuma — ele recebe
// oferta e trabalha. Então este bloco virou componente próprio: é a única
// coisa que sobra na tela depois que ele aceita.

const PRAZO_HORAS = 24;

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

function FileteDourado() {
  return (
    <div
      aria-hidden="true"
      className="mb-4 h-px rounded-full"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(244,206,31,0.7) 30%, rgba(244,206,31,0.9) 50%, rgba(244,206,31,0.7) 70%, transparent 100%)",
      }}
    />
  );
}

function restante(ate: string) {
  const ms = new Date(ate).getTime() - Date.now();
  if (ms <= 0) return "prazo vencido";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
}

// prazo desejado é data pura ("AAAA-MM-DD"), lida em UTC: no fuso do Brasil
// a meia-noite UTC cai no dia anterior
function dataCurta(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function MissaoEmMaos({ missao }: { missao: Pauta | null }) {
  const router = useRouter();
  const [linkEntrega, setLinkEntrega] = useState("");
  const [aviso, setAviso] = useState("");
  const [processando, setProcessando] = useState(false);
  const [agora, setAgora] = useState<number | null>(null);

  // o relógio só existe no cliente: ler Date.now() no servidor daria valor
  // diferente e quebraria a hidratação
  useEffect(() => {
    if (!missao?.reservadaAte) return;
    const tick = () => setAgora(Date.now());
    const inicial = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
    };
  }, [missao?.reservadaAte]);

  if (!missao) return null;

  async function chamar(acao: "entregar" | "cancelar", link?: string) {
    setAviso("");
    setProcessando(true);
    const resp = await fetch(`/api/pautas/${missao!.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(link ? { acao, link } : { acao }),
    });
    setProcessando(false);

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setAviso(dados?.erro ?? "Não deu pra concluir. Tenta de novo.");
      return;
    }
    setLinkEntrega("");
    router.refresh();
  }

  function entregar() {
    if (!linkEntrega.trim()) {
      setAviso("Cole o link do vídeo pronto antes de confirmar.");
      return;
    }
    chamar("entregar", linkEntrega.trim());
  }

  const temBrief =
    missao.brief.tom ||
    missao.brief.cor ||
    missao.brief.fonte ||
    missao.brief.refs ||
    missao.extras ||
    missao.motivo;

  // A missão continua "em mãos" depois de entregue — ela só sai daqui quando o
  // controle de qualidade aprova. Mas o card mostrava "Missão aceita" e o campo
  // de entrega nos três estados, então quem entregava via a tela idêntica: nada
  // dizia que tinha dado certo. O caminho natural era clicar de novo, e aí vinha
  // "Essa missão não está com você" — mensagem que soa como missão perdida,
  // quando na verdade estava tudo certo e só faltava avisar.
  const aguardandoRevisao = missao.status === "em_revisao";

  return (
    <section className="mb-10 rounded-2xl border border-gold-lo/50 bg-gradient-to-b from-gold/[0.07] to-transparent p-6 lg:p-8">
      <FileteDourado />
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-gold-lo/60 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold-hi">
          Sua missão
        </span>
        <span className="text-xs uppercase tracking-[0.15em] text-gold-hi">
          {aguardandoRevisao
            ? "Entregue · em revisão"
            : missao.status === "reedicao"
              ? "Ajuste pedido"
              : "Missão aceita"}
        </span>
        {/* o relógio é prazo de entrega: depois de entregue não conta mais nada */}
        {missao.reservadaAte && agora !== null && !aguardandoRevisao && (
          <span className="ml-auto text-sm text-muted">
            ⏳ {restante(missao.reservadaAte)}
          </span>
        )}
      </div>

      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        {missao.titulo}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {missao.portaVoz} · {ROTULO_FORMATO[missao.formato]}
        {missao.prazoDesejado && <> · pra {dataCurta(missao.prazoDesejado)}</>}
      </p>

      {/* quem pediu a reedição muda a conversa: o inspetor reprovou por
          qualidade, o porta-voz quer outra coisa */}
      {missao.status === "reedicao" && missao.notasInspetor && (
        <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/[0.06] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-danger">
            {missao.reedicaoPedidaPor === "porta_voz"
              ? "O porta-voz pediu um ajuste"
              : "O controle de qualidade pediu um ajuste"}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-text">
            {missao.notasInspetor}
          </p>
        </div>
      )}

      {missao.driveLink && pareceLinkDrive(missao.driveLink) && (
        <div className="mt-5 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">
            Acesso ao bruto
          </p>
          {/* Dizia "✓ Acesso liberado no Drive para seu e-mail", com check
              verde. Não era verdade: o login com Google pede só
              `openid email profile`, e não existe uma única chamada à API do
              Drive no projeto — ninguém libera pasta nenhuma. O editor clicava,
              batia num "você precisa de acesso" do Google e não entendia por
              quê. Enquanto a liberação for manual, a tela diz isso. */}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text">
            <a
              href={missao.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gold-hi hover:underline"
            >
              Abrir pasta no Drive
            </a>
          </p>
          <p className="mt-2 text-xs text-muted-2">
            Se o Drive pedir permissão, peça a liberação a quem criou a missão —
            hoje esse acesso ainda é liberado à mão.
          </p>
        </div>
      )}

      {temBrief && (
        <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">
            O que foi pedido
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {missao.brief.tom && <Chip k="tom" v={missao.brief.tom} />}
            {missao.brief.cor && <Chip k="cor" v={missao.brief.cor} />}
            {missao.brief.fonte && <Chip k="fonte" v={missao.brief.fonte} />}
            {missao.brief.refs && <Chip k="ref" v={missao.brief.refs} />}
          </div>
          {(missao.extras || missao.motivo) && (
            <div className="mt-3 flex flex-col gap-2 text-xs">
              {missao.extras && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    Cortes pedidos
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">
                    {missao.extras}
                  </p>
                </div>
              )}
              {missao.motivo && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    Contexto
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">
                    {missao.motivo}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {aguardandoRevisao ? (
        <>
          <div className="mt-5 rounded-2xl border border-ok/40 bg-ok/[0.06] p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-text">
              <span className="text-ok">✓</span> Entregue. Agora é com o controle
              de qualidade — assim que aprovarem, a próxima missão chega pra você.
              {missao.entregaLink && pareceLink(missao.entregaLink) && (
                <a
                  href={missao.entregaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold-hi hover:underline"
                >
                  Ver o que você entregou
                </a>
              )}
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-2">
            Precisa trocar o vídeo? Fale com quem pediu a missão — depois de
            aprovada, ela não volta pra edição sozinha.
          </p>
        </>
      ) : (
        <>
          <div className="mt-5">
            <label
              htmlFor="entrega"
              className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
            >
              Link do vídeo pronto
            </label>
            <input
              id="entrega"
              className="field-input !pl-4"
              placeholder="cole aqui o link do Drive"
              value={linkEntrega}
              onChange={(e) => {
                setLinkEntrega(e.target.value);
                setAviso("");
              }}
            />
          </div>

          {aviso && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {aviso}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={entregar} disabled={processando}>
              {processando ? "Enviando…" : "Confirmar entrega"}
            </button>
            <button
              className="btn-ghost sm:w-52"
              onClick={() => chamar("cancelar")}
              disabled={processando}
            >
              {processando ? "…" : "Devolver missão"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-2">
            Prazo de {PRAZO_HORAS}h pra entregar. Devolver libera a missão pra outro
            editor.
          </p>
        </>
      )}
    </section>
  );
}
