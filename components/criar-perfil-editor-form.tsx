"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ESTILOS,
  HEADLINES,
  MAX_ESTILOS,
  MAX_HEADLINES,
  NICHOS,
  NIVEIS_EDICAO,
  SETUPS_PC,
  SOFTWARES,
  type OpcaoComFrase,
} from "@/lib/perfil";
import { iniciais, TINT_PADRAO } from "@/lib/candidatos";
import type { OnboardingEditor } from "@/lib/perfil-db";
import { SelectEstadoCidade } from "@/components/select-estado-cidade";

/** extrai UF e cidade de um valor salvo no formato "Cidade/UF" ou "Cidade, UF" */
function parseLocalizacao(valor: string): { uf: string; cidade: string } {
  if (!valor) return { uf: "", cidade: "" };
  const match = valor.match(/^(.+?)[/,]\s*([A-Z]{2})$/);
  if (match) return { uf: match[2], cidade: match[1].trim() };
  return { uf: "", cidade: "" };
}

type Aba = "identidade" | "bancada" | "portfolio";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "identidade", rotulo: "Identidade" },
  { chave: "bancada", rotulo: "A Bancada" },
  { chave: "portfolio", rotulo: "Portfólio" },
];

function chip(ativo: boolean, bloqueado = false) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    bloqueado ? "cursor-not-allowed opacity-40" : ""
  } ${
    ativo
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

function cartao(ativo: boolean) {
  return `w-full rounded-xl border p-3 text-left transition-colors ${
    ativo
      ? "border-gold-lo bg-gold/10"
      : "border-line bg-surface hover:border-gold/30"
  }`;
}

/** Nível de Edição / Setup do PC: uma opção só, com frasezinha embaixo. */
function SeletorCartao({
  opcoes,
  valor,
  aoEscolher,
}: {
  opcoes: OpcaoComFrase[];
  valor: string;
  aoEscolher: (rotulo: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {opcoes.map((o) => (
        <button
          key={o.rotulo}
          type="button"
          onClick={() => aoEscolher(o.rotulo)}
          aria-pressed={valor === o.rotulo}
          className={cartao(valor === o.rotulo)}
        >
          <p className="text-sm font-medium text-text">{o.rotulo}</p>
          <p className="mt-0.5 text-xs text-muted">{o.frase}</p>
        </button>
      ))}
    </div>
  );
}

export function CriarPerfilEditorForm({ inicial }: { inicial: OnboardingEditor }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aba, setAba] = useState<Aba>("identidade");

  const [nome, setNome] = useState(inicial.nome);
  const [foto, setFoto] = useState<string | undefined>(inicial.fotoUrl || undefined);
  const parsed = parseLocalizacao(inicial.localizacao);
  const [estadoUf, setEstadoUf] = useState(parsed.uf);
  const [cidadeNome, setCidadeNome] = useState(parsed.cidade);
  const [headline, setHeadline] = useState<string[]>(inicial.headline);
  const [bio, setBio] = useState(inicial.bio);

  const [nivelEdicao, setNivelEdicao] = useState(inicial.nivelEdicao);
  const [setupPc, setSetupPc] = useState(inicial.setupPc);
  const [softwares, setSoftwares] = useState<string[]>(inicial.softwares);
  const [estilos, setEstilos] = useState<string[]>(inicial.estilos);

  const [portfolioLink, setPortfolioLink] = useState(inicial.portfolioLink);
  const [nicho, setNicho] = useState<string[]>(inicial.nicho);

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setFoto(leitor.result as string);
    leitor.readAsDataURL(arquivo);
  }

  function alternarSoftware(s: string) {
    setSoftwares((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
  }

  function alternarEstilo(e: string) {
    setEstilos((a) => {
      if (a.includes(e)) return a.filter((x) => x !== e);
      if (a.length >= MAX_ESTILOS) return a; // teto de 3
      return [...a, e];
    });
  }

  function alternarNicho(n: string) {
    setNicho((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  }

  function alternarHeadline(h: string) {
    setHeadline((a) => {
      if (a.includes(h)) return a.filter((x) => x !== h);
      if (a.length >= MAX_HEADLINES) return a; // teto
      return [...a, h];
    });
  }

  // progresso por etapa (1/3, 2/3, 3/3) — mais previsível que % de campos,
  // que podia mostrar 50% ainda na etapa 1 e confundir o editor
  const etapaIdx = ABAS.findIndex((a) => a.chave === aba);
  const etapaNum = etapaIdx + 1;
  const progresso = Math.round((etapaNum / ABAS.length) * 100);

  // Validação por etapa: ao avançar da etapa 1, checa os obrigatórios dela.
  // O editor ainda pode clicar numa aba do topo pra editar (não travamos isso),
  // mas o botão "Avançar" só deixa seguir se nome estiver preenchido.
  function avancarPara(a: Aba) {
    if (aba === "identidade" && !nome.trim()) {
      setErro("Precisa do seu nome pra continuar.");
      return;
    }
    setErro("");
    setAba(a);
  }

  async function concluir() {
    if (!nome.trim()) {
      setErro("Precisa do seu nome pra continuar.");
      setAba("identidade");
      return;
    }
    setErro("");
    setSalvando(true);

    const resp = await fetch("/api/editor/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        fotoUrl: foto,
        localizacao: cidadeNome ? `${cidadeNome}/${estadoUf}` : "",
        headline,
        bio,
        nivelEdicao,
        setupPc,
        softwares,
        estilos,
        portfolioLink,
        nicho,
      }),
    });
    setSalvando(false);

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setErro(dados?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    router.push("/editor");
    router.refresh();
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-2">
        <span>
          Perfil do editor · etapa {etapaNum} de {ABAS.length}
        </span>
        <span>{progresso}%</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi transition-all duration-300"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="mb-6 flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              aba === a.chave ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="mb-5 text-sm text-danger">
          {erro}
        </p>
      )}

      {/* ---- aba 1: identidade da forja ---- */}
      {aba === "identidade" && (
        <section className="reveal flex flex-col gap-8">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Quem é você
            </h2>
            <p className="mt-1 text-sm text-muted">
              É o que o porta-voz vê antes de escolher quem edita. A foto é
              opcional: sem ela, usamos suas iniciais.
            </p>

            <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface transition-colors hover:border-gold/50"
                >
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview local, sem otimização
                    <img src={foto} alt="Sua foto" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="grid h-full w-full place-items-center font-[family-name:var(--font-display)] text-3xl font-semibold text-black/80"
                      style={{ background: TINT_PADRAO }}
                    >
                      {iniciais(nome || inicial.nome)}
                    </span>
                  )}
                  <span className="absolute inset-0 hidden items-center justify-center bg-ink/60 text-xs font-medium text-silver-hi group-hover:flex">
                    {foto ? "Trocar" : "Enviar foto"}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onEscolherFoto}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 text-xs font-medium text-gold-hi hover:underline"
                >
                  {foto ? "Escolher outra" : "Escolher da galeria"}
                </button>
                {foto && (
                  <button
                    type="button"
                    onClick={() => setFoto(undefined)}
                    className="mt-1 text-[11px] text-muted-2 hover:text-muted"
                  >
                    Pular por agora (usar iniciais)
                  </button>
                )}
              </div>

              <div className="w-full flex-1">
                <label
                  htmlFor="nome"
                  className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
                >
                  Nome
                </label>
                <input
                  id="nome"
                  className="field-input !pl-4"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setErro("");
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <SelectEstadoCidade
                valorEstado={estadoUf}
                valorCidade={cidadeNome}
                onChangeEstado={setEstadoUf}
                onChangeCidade={setCidadeNome}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                Especialidades
              </label>
              <p className="mb-2 text-xs text-muted-2">
                Até {MAX_HEADLINES}. É o que casa você com o porta-voz na hora do match.
              </p>
              <div className="flex flex-col gap-3">
                {HEADLINES.map((grupo) => (
                  <div key={grupo.categoria}>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-2">
                      {grupo.categoria}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {grupo.tags.map((h) => {
                        const ativo = headline.includes(h);
                        const bloqueado = !ativo && headline.length >= MAX_HEADLINES;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              alternarHeadline(h);
                              setErro("");
                            }}
                            disabled={bloqueado}
                            aria-pressed={ativo}
                            className={chip(ativo, bloqueado)}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {headline.length >= MAX_HEADLINES && (
                <p className="mt-2 text-xs text-muted-2">Máximo de {MAX_HEADLINES} especialidades.</p>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="bio"
                className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
              >
                Bio curta
              </label>
              <textarea
                id="bio"
                rows={3}
                className="field-input !pl-4 resize-none"
                placeholder="Breve descrição da sua experiência ou estilo."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => avancarPara("bancada")}
          >
            Avançar →
          </button>
        </section>
      )}

      {/* ---- aba 2: a bancada (ferramentas e setup) ---- */}
      {aba === "bancada" && (
        <section className="reveal flex flex-col gap-8">
          <button
            type="button"
            onClick={() => setAba("identidade")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (identidade)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Nível de edição
            </h2>
            <p className="mt-1 text-sm text-muted">Sem julgamento — é só pra calibrar sua fila.</p>
            <SeletorCartao opcoes={NIVEIS_EDICAO} valor={nivelEdicao} aoEscolher={setNivelEdicao} />
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Poder de processamento
            </h2>
            <p className="mt-1 text-sm text-muted">O setup que você usa pra editar.</p>
            <SeletorCartao opcoes={SETUPS_PC} valor={setupPc} aoEscolher={setSetupPc} />
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Ferramentas
            </h2>
            <p className="mt-1 text-sm text-muted">Onde você edita. Pode marcar mais de um.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SOFTWARES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => alternarSoftware(s)}
                  aria-pressed={softwares.includes(s)}
                  className={chip(softwares.includes(s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Seu estilo
            </h2>
            <p className="mt-1 text-sm text-muted">
              Até {MAX_ESTILOS}. É o que casa você com o tom da pauta na hora do match.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ESTILOS.map((e) => {
                const ativo = estilos.includes(e);
                const bloqueado = !ativo && estilos.length >= MAX_ESTILOS;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => alternarEstilo(e)}
                    disabled={bloqueado}
                    aria-pressed={ativo}
                    className={chip(ativo, bloqueado)}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            {estilos.length >= MAX_ESTILOS && (
              <p className="mt-2 text-xs text-muted-2">Máximo de {MAX_ESTILOS} estilos.</p>
            )}
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => avancarPara("portfolio")}
          >
            Avançar →
          </button>
        </section>
      )}

      {/* ---- aba 3: o portfólio (sua arte) ---- */}
      {aba === "portfolio" && (
        <section className="reveal flex flex-col gap-8">
          <button
            type="button"
            onClick={() => setAba("bancada")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (a bancada)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Portfólio
            </h2>
            <p className="mt-1 text-sm text-muted">
              Um link com trabalho seu (YouTube, Vimeo, Drive) — de 2 a 2:30 min.
            </p>
            <input
              id="portfolio"
              className="field-input !pl-4 mt-3"
              placeholder="https://…"
              value={portfolioLink}
              onChange={(e) => setPortfolioLink(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-2">
              Depois da primeira entrega aprovada, seu portfólio aqui dentro se preenche sozinho.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Nicho de atuação
            </h2>
            <p className="mt-1 text-sm text-muted">Pode marcar os dois, se editar nos dois formatos.</p>
            <div className="mt-3 flex flex-col gap-2">
              {NICHOS.map((n) => {
                const ativo = nicho.includes(n.rotulo);
                return (
                  <button
                    key={n.rotulo}
                    type="button"
                    onClick={() => alternarNicho(n.rotulo)}
                    aria-pressed={ativo}
                    className={cartao(ativo)}
                  >
                    <p className="text-sm font-medium text-text">{n.rotulo}</p>
                    <p className="mt-0.5 text-xs text-muted">{n.frase}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" className="btn-gold" onClick={concluir} disabled={salvando}>
            {salvando ? "Salvando…" : "Concluir e ver a fila"}
          </button>
        </section>
      )}
    </div>
  );
}
