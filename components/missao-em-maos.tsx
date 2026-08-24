"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { pareceLinkDrive, pareceLinkYoutube } from "@/lib/validators";
import { ChatMissao } from "@/components/chat-missao";
import { BotaoTutorial, TutorialDrive } from "@/components/tutorial-drive";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { Mensagem } from "@/lib/chat-db";
import { DenunciaBotao } from "@/components/denuncia-botao";

// A missão que o editor aceitou e está fazendo agora.
//
// Vivia dentro de fila-pautas.tsx, junto da lista de missões disponíveis.
// Com o dispatch, o editor não navega mais por lista nenhuma — ele recebe
// oferta e trabalha. Então este bloco virou componente próprio: é a única
// coisa que sobra na tela depois que ele aceita.

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

// prazo desejado é data pura ("AAAA-MM-DD"), lida em UTC: no fuso do Brasil
// a meia-noite UTC cai no dia anterior
function dataCurta(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function MissaoEmMaos({
  missao,
  mensagens = [],
}: {
  missao: Pauta | null;
  /** thread da missão — o editor conversa com quem pediu o vídeo */
  mensagens?: Mensagem[];
}) {
  const router = useRouter();
  const [linkEntrega, setLinkEntrega] = useState("");
  const [aviso, setAviso] = useState("");
  const [processando, setProcessando] = useState(false);
  const [tutorialAberto, setTutorialAberto] = useState(false);

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
        {/* sem prazo de entrega: a missão é do editor até entregar ou devolver */}
      </div>

      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        {missao.titulo}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {missao.portaVoz} · {ROTULO_FORMATO[missao.formato]}
        {missao.prazoDesejado && <> · pra {dataCurta(missao.prazoDesejado)}</>}
      </p>

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

      {(missao.marcaDagua || missao.cnpjCampanha || missao.tituloEleitor) && (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 flex gap-3">
          <div className="mt-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gold">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">
              Inclusão Obrigatória (TSE)
            </p>
            <p className="mt-1 text-sm text-silver-lo">
              As seguintes informações devem aparecer de forma legível no vídeo final:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text">
              {missao.marcaDagua && <li><span className="text-muted-2">Marca d&apos;água:</span> {missao.marcaDagua}</li>}
              {missao.cnpjCampanha && <li><span className="text-muted-2">CNPJ:</span> {missao.cnpjCampanha}</li>}
              {missao.tituloEleitor && <li><span className="text-muted-2">Título de Eleitor:</span> {missao.tituloEleitor}</li>}
            </ul>
          </div>
        </div>
      )}

      {(missao.videoBrutoUrl || (missao.driveLink && pareceLinkDrive(missao.driveLink)) || (missao.youtubeLink && pareceLinkYoutube(missao.youtubeLink))) && (
        <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.08] to-gold/[0.03] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold">
            Acesso ao bruto
          </p>
          <p
            className="mt-3 flex flex-wrap items-center gap-2"
            data-guia="abrir-bruto"
          >
            {missao.videoBrutoUrl && (
              <a
                href={missao.videoBrutoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-base font-semibold text-surface transition-colors hover:bg-gold-hi"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1z" clipRule="evenodd" />
                  <path d="M4 16a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
                </svg>
                Baixar Vídeo
              </a>
            )}
            {missao.driveLink && pareceLinkDrive(missao.driveLink) && (
              <a
                href={missao.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-base font-semibold text-gold-hi transition-colors hover:bg-gold/20"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Abrir pasta no Drive
              </a>
            )}
            {missao.youtubeLink && pareceLinkYoutube(missao.youtubeLink) && (
              <a
                href={missao.youtubeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-base font-semibold text-gold-hi transition-colors hover:bg-gold/20"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Abrir no YouTube
              </a>
            )}
          </p>
          <p className="mt-3 text-xs text-muted-2">
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
              {(missao.videoEntregaUrl || missao.entregaLink) && (
                <a
                  href={missao.videoEntregaUrl || missao.entregaLink}
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
          <div className="mt-5" data-guia="campo-entrega">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-gold">
              Entregar Vídeo Pronto
            </h3>

            <UploadDropzone
              label="Fazer upload do vídeo editado"
              onUploadSuccess={(url) => {
                setLinkEntrega(url);
                setAviso("");
              }}
            />

            <div className="mt-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[10px] text-muted font-medium uppercase tracking-widest">OU COLE UM LINK</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="mt-4 flex gap-2">
              <input
                id="entrega"
                className="field-input !pl-4"
                placeholder="cole aqui o link do Drive (opcional se fez upload)"
                value={linkEntrega}
                onChange={(e) => {
                  setLinkEntrega(e.target.value);
                  setAviso("");
                }}
              />
              <BotaoTutorial onClick={() => setTutorialAberto(true)} />
            </div>
          </div>

          <TutorialDrive
            tipo="entrega"
            aberto={tutorialAberto}
            aoFechar={() => setTutorialAberto(false)}
          />

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
            Sem prazo — a missão é sua até entregar. Devolver libera pra outro editor.
          </p>
        </>
      )}

      {/* conversa com quem pediu o vídeo — dúvida vai aqui, não se perde no chat pessoal */}
      <div className="mt-6">
        <ChatMissao pautaId={missao.id} mensagens={mensagens} />
      </div>
      <div className="mt-4">
        <DenunciaBotao pautaId={missao.id} />
      </div>
    </section>
  );
}
