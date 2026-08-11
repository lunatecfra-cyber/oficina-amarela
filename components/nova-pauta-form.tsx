"use client";

import { useState } from "react";
import Link from "next/link";
import type { Formato } from "@/lib/pautas";

type Dados = {
  titulo: string;
  driveLink: string;
  extras: string;
  tom: string;
  cor: string;
  fonte: string;
  refs: string;
  motivo: string;
  formato: Formato | "";
  prazo: string;
};

const VAZIO: Dados = {
  titulo: "",
  driveLink: "",
  extras: "",
  tom: "",
  cor: "",
  fonte: "",
  refs: "",
  motivo: "",
  formato: "",
  prazo: "",
};

const PASSOS = [
  "O vídeo bruto",
  "Cortes específicos",
  "O estilo",
  "Contexto",
  "Formato e prazo",
];

function pareceLink(v: string) {
  return /^(https?:\/\/|www\.)/i.test(v.trim());
}

function pareceLinkDrive(v: string) {
  return /drive\.google\.com/i.test(v.trim());
}

export function NovaPautaForm() {
  const [passo, setPasso] = useState(0);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => {
    setDados((d) => ({ ...d, [k]: v }));
    setErro("");
  };

  function validar(p: number): string {
    if (p === 0) {
      if (!dados.titulo.trim()) return "Dê um título pra missão.";
      if (!dados.driveLink.trim()) return "Cole o link do Drive com o vídeo bruto.";
      if (!pareceLink(dados.driveLink)) return "Isso não parece um link. Confere?";
      if (!pareceLinkDrive(dados.driveLink))
        return "Isso não parece um link do Google Drive. Cole o link de compartilhamento do Drive (drive.google.com).";
    }
    if (p === 4 && !dados.formato) return "Escolha o formato.";
    return "";
  }

  function avancar() {
    const e = validar(passo);
    if (e) return setErro(e);
    if (passo < PASSOS.length - 1) setPasso(passo + 1);
    else enviar();
  }

  function voltar() {
    setErro("");
    if (passo > 0) setPasso(passo - 1);
  }

  async function enviar() {
    setEnviando(true);
    // grava no Postgres via API. Antes isto era só um setTimeout fingindo
    // sucesso — a pauta sumia. O bug #5 da AUDITORIA-BUGS.md (client não
    // consegue mutar o estado que o Server Component renderiza) se resolve
    // justamente assim: o dado vai pro banco, não pra memória do navegador.
    const resp = await fetch("/api/pautas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: dados.titulo,
        formato: dados.formato,
        driveLink: dados.driveLink,
        tom: dados.tom,
        cor: dados.cor,
        fonte: dados.fonte,
        refs: dados.refs,
        extras: dados.extras,
        motivo: dados.motivo,
        prazo: dados.prazo,
      }),
    });
    const corpo = await resp.json().catch(() => null);
    setEnviando(false);

    if (!resp.ok) {
      setErro(corpo?.erro ?? "Não deu pra criar a missão. Tenta de novo.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mx-auto w-full max-w-lg py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-ok/40 bg-ok/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-8 w-8 text-ok"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">
          Missão enviada!
        </h1>
        <p className="mt-3 text-muted">
          Ela já está na fila dos editores. Você acompanha o status na sua área e
          recebe o vídeo pronto por aqui.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/porta-voz" className="btn-gold sm:w-56">
            Ver minhas missões
          </Link>
          <button
            className="btn-ghost sm:w-56"
            onClick={() => {
              setDados(VAZIO);
              setPasso(0);
              setEnviado(false);
            }}
          >
            Criar outra missão
          </button>
        </div>
      </div>
    );
  }

  const ultimo = passo === PASSOS.length - 1;

  return (
    <div className="mx-auto w-full max-w-xl py-8 lg:py-12">
      {/* progresso */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="uppercase tracking-[0.14em] text-gold">
            Passo {passo + 1} de {PASSOS.length}
          </span>
          <span>{PASSOS[passo]}</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {PASSOS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= passo ? "bg-gold" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-h-[280px]">
        {passo === 0 && (
          <Passo titulo="O vídeo bruto" sub="O material que o editor vai trabalhar.">
            <Campo label="Título da missão">
              <input
                className="field-input !pl-4"
                placeholder="ex.: Corte sobre segurança no bairro"
                value={dados.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                autoFocus
              />
            </Campo>
            <Campo label="Link do Drive com o bruto">
              <input
                className="field-input !pl-4"
                placeholder="cole o link de compartilhamento"
                value={dados.driveLink}
                onChange={(e) => set("driveLink", e.target.value)}
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Campo>
          </Passo>
        )}

        {passo === 1 && (
          <Passo
            titulo="Cortes específicos"
            sub="Tem algum trecho, corte ou material extra que precisa entrar? (opcional)"
          >
            <Campo label="Links ou trechos (um por linha)">
              <textarea
                className="field-input !pl-4 min-h-32 resize-y"
                placeholder={"ex.: usar do minuto 3:20 ao 3:45\nlink de outro bruto pra encaixar"}
                value={dados.extras}
                onChange={(e) => set("extras", e.target.value)}
              />
            </Campo>
          </Passo>
        )}

        {passo === 2 && (
          <Passo
            titulo="O estilo"
            sub="Quanto mais claro, mais o editor acerta de primeira. (opcional)"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Tom">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: direto e firme"
                  value={dados.tom}
                  onChange={(e) => set("tom", e.target.value)}
                />
              </Campo>
              <Campo label="Cor">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: quente / fria"
                  value={dados.cor}
                  onChange={(e) => set("cor", e.target.value)}
                />
              </Campo>
              <Campo label="Fonte / legenda">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: bold condensada"
                  value={dados.fonte}
                  onChange={(e) => set("fonte", e.target.value)}
                />
              </Campo>
              <Campo label="Referências">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: estilo podcast"
                  value={dados.refs}
                  onChange={(e) => set("refs", e.target.value)}
                />
              </Campo>
            </div>
          </Passo>
        )}

        {passo === 3 && (
          <Passo
            titulo="Contexto"
            sub="Por que esse vídeo importa? Ajuda o editor a entender a intenção. (opcional)"
          >
            <Campo label="Motivo / motivação">
              <textarea
                className="field-input !pl-4 min-h-32 resize-y"
                placeholder="ex.: resposta a um tema que bombou essa semana"
                value={dados.motivo}
                onChange={(e) => set("motivo", e.target.value)}
              />
            </Campo>
          </Passo>
        )}

        {passo === 4 && (
          <Passo titulo="Formato e prazo" sub="Como e pra quando você precisa.">
            <Campo label="Formato">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { v: "short", t: "Short 9:16", d: "vertical" },
                    { v: "longo", t: "Longo 16:9", d: "horizontal" },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.v}
                    type="button"
                    onClick={() => set("formato", op.v)}
                    aria-pressed={dados.formato === op.v}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      dados.formato === op.v
                        ? "border-gold bg-gold/10"
                        : "border-line bg-surface hover:border-silver-lo"
                    }`}
                  >
                    <span className="block font-medium text-text">{op.t}</span>
                    <span className="text-xs text-muted">{op.d}</span>
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label="Prazo desejado (opcional)">
              <input
                type="date"
                className="field-input !pl-4"
                value={dados.prazo}
                onChange={(e) => set("prazo", e.target.value)}
              />
            </Campo>
          </Passo>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {passo > 0 ? (
          <button className="btn-ghost w-32" onClick={voltar}>
            Voltar
          </button>
        ) : (
          <Link href="/porta-voz" className="btn-ghost w-32 text-center">
            Cancelar
          </Link>
        )}
        <button className="btn-gold flex-1" onClick={avancar} disabled={enviando}>
          {enviando ? "Enviando…" : ultimo ? "Enviar missão" : "Continuar"}
        </button>
      </div>
    </div>
  );
}

function Passo({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        {titulo}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">{sub}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
