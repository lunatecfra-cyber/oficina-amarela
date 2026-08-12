"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PAUTAS, ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { iniciais, type Candidato } from "@/lib/candidatos";
import { LocalProximidade } from "@/components/local-proximidade";
import { Selo, Chip, candidatoDaPauta } from "@/components/pauta-ui";

export function FilaInspetor({
  pautasReais = [],
  candidatosPorApelido = {},
}: {
  pautasReais?: Pauta[];
  /** perfil real dos porta-vozes das pautas acima, por apelido (vem do banco) */
  candidatosPorApelido?: Record<string, Candidato>;
}) {
  const router = useRouter();
  const [pautas, setPautas] = useState<Pauta[]>([...pautasReais, ...PAUTAS]);
  const [erro, setErro] = useState("");

  const emRevisao = pautas.filter((p) => p.status === "em_revisao");

  const ehPautaReal = (id: string) => id.startsWith("db-");

  async function chamarApi(id: string, corpo: Record<string, unknown>): Promise<boolean> {
    const resp = await fetch(`/api/pautas/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setErro(dados?.erro ?? "Não deu pra concluir. Tenta de novo.");
      return false;
    }
    setErro("");
    return true;
  }

  /**
   * Aprovar é o que faz os números do editor mexerem: entregues sobe (e o
   * nível junto), a nota média é recalculada e o streak avança — tudo no
   * banco, não na tela.
   */
  async function aprovar(id: string, nota?: number) {
    if (ehPautaReal(id) && !(await chamarApi(id, { acao: "aprovar", nota }))) return;

    setPautas((lista) =>
      lista.map((p) => (p.id === id ? { ...p, status: "aprovada", notasInspetor: undefined } : p))
    );
    router.refresh();
  }

  async function pedirReedicao(id: string, nota: string) {
    if (ehPautaReal(id) && !(await chamarApi(id, { acao: "reedicao", notas: nota }))) return;

    setPautas((lista) =>
      lista.map((p) => (p.id === id ? { ...p, status: "reedicao", notasInspetor: nota } : p))
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
          <p className="mt-1 text-sm text-muted">
            Aprove ou peça reedição das missões entregues.
          </p>
        </div>
        <p className="text-sm text-muted">{emRevisao.length} aguardando</p>
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {erro}
        </p>
      )}

      {emRevisao.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line-soft bg-surface/40 p-10 text-center text-sm text-muted">
          Nada pra revisar agora.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {emRevisao.map((p) => (
            <CardRevisao
              key={p.id}
              pauta={p}
              onAprovar={(estrelas) => aprovar(p.id, estrelas)}
              onPedirReedicao={(nota) => pedirReedicao(p.id, nota)}
              candidatosPorApelido={candidatosPorApelido}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CardRevisao({
  pauta: p,
  onAprovar,
  onPedirReedicao,
  candidatosPorApelido = {},
}: {
  pauta: Pauta;
  onAprovar: (estrelas?: number) => void;
  onPedirReedicao: (nota: string) => void;
  candidatosPorApelido?: Record<string, Candidato>;
}) {
  const [abrindoReedicao, setAbrindoReedicao] = useState(false);
  const [nota, setNota] = useState("");
  const [estrelas, setEstrelas] = useState<number | undefined>(undefined);
  const [aviso, setAviso] = useState("");
  const cand = candidatoDaPauta(p, candidatosPorApelido);

  function confirmarReedicao() {
    if (!nota.trim()) {
      setAviso("Escreve o que precisa mudar antes de devolver.");
      return;
    }
    onPedirReedicao(nota.trim());
  }

  return (
    <li className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Link
          href={`/candidato/${cand.slug}`}
          className="group flex flex-none items-center gap-3 lg:w-56"
        >
          <span
            className="grid h-12 w-12 flex-none place-items-center rounded-xl font-[family-name:var(--font-display)] text-sm font-semibold text-black/80"
            style={{ background: cand.tint }}
          >
            {iniciais(cand.nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-text transition-colors group-hover:text-gold-hi">
              {cand.nome}
            </p>
            <p className="truncate text-xs text-muted">{cand.cargo}</p>
            <LocalProximidade
              local={cand.local}
              proximidade={cand.proximidade}
              className="text-xs text-muted-2"
            />
          </div>
        </Link>

        <div className="min-w-0 flex-1 lg:border-l lg:border-line lg:pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {p.titulo}
            </h3>
            <Selo status={p.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-muted">
              {ROTULO_FORMATO[p.formato]}
            </span>
            {p.brief.tom && <Chip k="tom" v={p.brief.tom} />}
            {p.brief.cor && <Chip k="cor" v={p.brief.cor} />}
            {p.brief.fonte && <Chip k="fonte" v={p.brief.fonte} />}
            {p.brief.refs && <Chip k="ref" v={p.brief.refs} />}
          </div>
          <p className="mt-2 text-xs text-muted">
            Entregue por <span className="text-text">{p.reservadaPor}</span>
            {p.entregaLink && (
              <>
                {" "}
                ·{" "}
                <a
                  href={p.entregaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold-hi hover:underline"
                >
                  Abrir vídeo entregue
                </a>
              </>
            )}
          </p>
        </div>

        {!abrindoReedicao && (
          <div className="flex flex-none items-center gap-2 lg:w-56 lg:flex-col lg:items-stretch">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Dar nota ${n}`}
                  aria-pressed={estrelas === n}
                  onClick={() => setEstrelas(n)}
                  className={`text-lg leading-none transition-opacity ${
                    estrelas && n <= estrelas ? "opacity-100" : "opacity-30 hover:opacity-60"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <button className="btn-gold whitespace-nowrap" onClick={() => onAprovar(estrelas)}>
              Aprovar
            </button>
            <button
              className="btn-ghost whitespace-nowrap"
              onClick={() => setAbrindoReedicao(true)}
            >
              Pedir reedição
            </button>
          </div>
        )}
      </div>

      {abrindoReedicao && (
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
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              setAviso("");
            }}
          />
          {aviso && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {aviso}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={confirmarReedicao}>
              Confirmar reedição
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setAbrindoReedicao(false);
                setNota("");
                setAviso("");
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
