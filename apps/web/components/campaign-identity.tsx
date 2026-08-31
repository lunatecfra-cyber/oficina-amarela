"use client";

import { validateCampaignIdentity } from "@oficina/domain/campaign-identity";
import { useRef, useState } from "react";

/**
 * Identificação de campanha: os três dados que a lei manda aparecer no vídeo,
 * e a tarja pronta pro editor encaixar na lateral.
 *
 * A REGRA não mora aqui: quem valida e normaliza é `lib/campaign-identity.ts`
 * (número de urna de 2 a 5 dígitos, CNPJ com máscara). Este arquivo só desenha.
 * Duas validações pro mesmo dado divergem na primeira mudança.
 *
 * O PNG é gerado no navegador, em canvas: nada sobe, nada é salvo.
 */

/** Proporção da tarja: estreita e alta, pra encostar na lateral do vídeo. */
const BADGE_W = 260;
const BADGE_H = 1560;

export type CampaignIdentityProps = {
  name: string;
  onNameChange: (v: string) => void;
  candidateNumber: string;
  onCandidateNumberChange: (v: string) => void;
  campaignTaxId: string;
  onCampaignTaxIdChange: (v: string) => void;
  /** classe de label do formulário que hospeda, pra não destoar */
  labelClassName?: string;
};

export function CampaignIdentity({
  name,
  onNameChange,
  candidateNumber,
  onCandidateNumberChange,
  campaignTaxId,
  onCampaignTaxIdChange,
  labelClassName = "mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-muted",
}: CampaignIdentityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baixando, setBaixando] = useState(false);

  const validacao = validateCampaignIdentity({
    officialName: name,
    candidateNumber,
    campaignTaxId,
  });
  const completo = validacao.ok;
  const valores = validacao.ok ? validacao.value : null;

  // placeholder só na PRÉVIA, nunca no arquivo baixado
  const nomeTarja = name.trim() || "NOME OFICIAL";
  const numeroTarja = candidateNumber.trim() || "00";
  const cnpjTarja = campaignTaxId.trim() || "00.000.000/0000-00";

  function desenhar(ctx: CanvasRenderingContext2D) {
    if (!valores) return;
    ctx.clearRect(0, 0, BADGE_W, BADGE_H);

    // fundo quase preto: contraste alto contra texto claro
    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, BADGE_W, BADGE_H);

    // filete dourado na borda interna, o único enfeite
    ctx.strokeStyle = "#f4ce1f";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, BADGE_W - 6, BADGE_H - 6);

    // tudo girado: o texto sobe pela lateral
    ctx.save();
    ctx.translate(BADGE_W / 2, BADGE_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Arial em vez das fontes do site: o canvas não espera a fonte carregar e
    // desenharia num fallback qualquer, sem avisar.
    const linhas = [
      { texto: "PROPAGANDA ELEITORAL", tamanho: 40, cor: "#f4ce1f", peso: "bold", espaco: 76 },
      {
        texto: valores.officialName.toUpperCase(),
        tamanho: 56,
        cor: "#ffffff",
        peso: "bold",
        espaco: 86,
      },
      {
        texto: `Nº ${valores.candidateNumber}`,
        tamanho: 48,
        cor: "#f4ce1f",
        peso: "bold",
        espaco: 72,
      },
      {
        texto: `CNPJ ${valores.campaignTaxId}`,
        tamanho: 36,
        cor: "#e6e6ea",
        peso: "normal",
        espaco: 0,
      },
    ];

    const alturaTotal = linhas.reduce((s, l) => s + l.espaco, 0);
    let y = -alturaTotal / 2;

    for (const l of linhas) {
      ctx.font = `${l.peso} ${l.tamanho}px Arial, sans-serif`;
      ctx.fillStyle = l.cor;
      ctx.fillText(l.texto, 0, y);
      y += l.espaco;
    }

    ctx.restore();
  }

  async function baixarPng() {
    const canvas = canvasRef.current;
    if (!canvas || !valores) return;
    setBaixando(true);
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      desenhar(ctx);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tarja-${valores.candidateNumber}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // sem revoke o blob fica na memória até fechar a aba
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
      {/* Os campos */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="ci-nome" className={labelClassName}>
            Nome oficial <span className="text-gold">*</span>
          </label>
          <input
            id="ci-nome"
            className="field-input !pl-4"
            placeholder="como está na urna"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted-2">
            É o mesmo nome do seu perfil — mudar aqui muda nos dois lugares.
          </p>
        </div>

        <div>
          <label htmlFor="ci-numero" className={labelClassName}>
            Número eleitoral <span className="text-gold">*</span>
          </label>
          <input
            id="ci-numero"
            className="field-input !pl-4"
            placeholder="ex.: 13"
            inputMode="numeric"
            maxLength={5}
            value={candidateNumber}
            onChange={(e) => onCandidateNumberChange(e.target.value.replace(/\D/g, ""))}
          />
          <p className="mt-1.5 text-xs text-muted-2">
            O número que aparece na urna, de 2 a 5 dígitos.
          </p>
        </div>

        <div>
          <label htmlFor="ci-cnpj" className={labelClassName}>
            CNPJ da campanha <span className="text-gold">*</span>
          </label>
          <input
            id="ci-cnpj"
            className="field-input !pl-4"
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            value={campaignTaxId}
            onChange={(e) => onCampaignTaxIdChange(e.target.value)}
          />
        </div>

        {/* O erro vem da mesma função que valida no envio: nunca há divergência
            entre o que a prévia recusa e o que o formulário reclama. */}
        {!validacao.ok && (name.trim() || candidateNumber.trim() || campaignTaxId.trim()) && (
          <p className="text-xs text-muted">{validacao.error}</p>
        )}
      </div>

      {/* A prévia. Ao lado no PC, embaixo no celular. */}
      <div className="flex flex-col items-center gap-3 lg:w-64">
        <p className="self-start text-xs font-medium uppercase tracking-[0.1em] text-muted lg:self-center">
          Prévia da tarja
        </p>

        <div
          className="tarja-previa relative flex select-none items-center justify-center overflow-hidden rounded-lg"
          role="img"
          aria-label={`Tarja de propaganda eleitoral: ${nomeTarja}, número ${numeroTarja}, CNPJ ${cnpjTarja}`}
        >
          <div className="tarja-conteudo">
            <span className="tarja-rotulo">PROPAGANDA ELEITORAL</span>
            <span className="tarja-nome">{nomeTarja.toUpperCase()}</span>
            <span className="tarja-numero">Nº {numeroTarja}</span>
            <span className="tarja-dado">CNPJ {cnpjTarja}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={baixarPng}
          disabled={!completo || baixando}
          className="btn-gold w-full"
        >
          {baixando ? "Gerando…" : "Baixar PNG"}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-2">
          {completo
            ? `PNG de ${BADGE_W}×${BADGE_H}. Encaixe na lateral do vídeo, no CapCut.`
            : "Preencha os três campos pra liberar o download."}
        </p>

        {/* o canvas é a oficina do PNG: existe, mas ninguém vê */}
        <canvas
          ref={canvasRef}
          width={BADGE_W}
          height={BADGE_H}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <style>{`
        /* A prévia imita o PNG: mesma proporção, mesma ordem, mesmo contraste.
           Girar o BLOCO (e não cada letra) mantém as palavras legíveis de lado,
           que é como a tarja aparece encostada na lateral do vídeo. */
        .tarja-previa {
          width: 76px;
          height: 456px;
          background: #0a0a0b;
          border: 2px solid #f4ce1f;
        }
        .tarja-conteudo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          /* largura = altura da tarja, porque depois do giro os eixos trocam */
          width: 440px;
          transform: rotate(-90deg);
          font-family: Arial, Helvetica, sans-serif;
          line-height: 1.1;
          white-space: nowrap;
        }
        .tarja-rotulo {
          color: #f4ce1f;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }
        .tarja-nome {
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.04em;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tarja-numero {
          color: #f4ce1f;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }
        .tarja-dado {
          color: #e6e6ea;
          font-size: 12px;
          letter-spacing: 0.06em;
        }

        @media (min-width: 1024px) {
          .tarja-previa { width: 88px; height: 528px; }
          .tarja-conteudo { width: 508px; }
        }
      `}</style>
    </div>
  );
}
