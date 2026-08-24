"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ANOS_ELEICAO,
  BANDEIRAS_TEMAS,
  CARGOS_POLITICOS,
  ESTADOS_BRASIL,
  EXEMPLOS_TOM,
  PALAVRAS_CHAVE_SUGERIDAS,
  TINT_PADRAO,
  TONS_COMUNICACAO,
  gerarBioSugerida,
  iniciais,
  type RedesSociais,
} from "@/lib/candidatos";
import type { OnboardingCandidato } from "@/lib/candidato-db";
import { IconInstagram, IconTiktok, IconX, IconYoutube } from "@/components/icones-redes";
import { SelectEstadoCidade } from "@/components/select-estado-cidade";
import { comprimirFoto } from "@/lib/comprimir-foto";
import { AvisoTse } from "@/components/aviso-tse";

// Mesma forma de edição do wizard de criar-perfil, mas num página só — sem
// etapas, sem "Avançar". O porta-voz que só quer trocar a bio não refaz o
// cadastro inteiro. Reusa o mesmo POST /api/porta-voz/perfil do onboarding.

/** extrai UF e cidade de um valor salvo no formato "Cidade/UF" ou "Cidade, UF" */
function parseLocalizacao(valor: string): { uf: string; cidade: string } {
  if (!valor) return { uf: "", cidade: "" };
  const match = valor.match(/^(.+?)[/,]\s*([A-Z]{2})$/);
  if (match) return { uf: match[2], cidade: match[1].trim() };
  return { uf: "", cidade: "" };
}

function chip(ativo: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    ativo
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

const tituloSecao = "font-[family-name:var(--font-display)] text-xl font-semibold text-text";
const rotuloCampo = "mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted";

export function EditarPerfilCandidatoForm({ inicial }: { inicial: OnboardingCandidato }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(inicial.nome);
  const [foto, setFoto] = useState<string | undefined>(inicial.fotoUrl || undefined);
  const [fotoProcessando, setFotoProcessando] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const [cargo, setCargo] = useState(inicial.cargo);
  const [disputaPor, setDisputaPor] = useState(inicial.disputaPor);
  const [anoEleicao, setAnoEleicao] = useState(inicial.anoEleicao || "2026");
  const parsed = parseLocalizacao(inicial.localizacao);
  const [estadoUf, setEstadoUf] = useState(parsed.uf);
  const [cidadeNome, setCidadeNome] = useState(parsed.cidade);
  const [bandeiras, setBandeiras] = useState<string[]>(inicial.bandeiras);

  const [tom, setTom] = useState(inicial.tomComunicacao);
  const [palavrasChave, setPalavrasChave] = useState<string[]>(inicial.palavrasChave);
  const [novaPalavraChave, setNovaPalavraChave] = useState("");
  const [bio, setBio] = useState(inicial.bio);
  const [marcaDagua, setMarcaDagua] = useState(inicial.marcaDagua || "");
  const [cnpjCampanha, setCnpjCampanha] = useState(inicial.cnpjCampanha || "");
  const [tituloEleitor, setTituloEleitor] = useState(inicial.tituloEleitor || "");

  const [redes, setRedes] = useState<RedesSociais>(inicial.redes);

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // A foto é encolhida aqui, no aparelho, antes de subir. Antes ia crua: foto
  // de celular tem 3 a 8 MB, o teto de gravação é 1,5 MB, e quase toda foto era
  // recusada com uma mensagem que a pessoa não tinha como cumprir.
  async function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setFotoProcessando(true);
    setErroFoto("");
    const r = await comprimirFoto(arquivo);
    setFotoProcessando(false);

    if (!r.ok) {
      setErroFoto(r.erro);
      return;
    }
    setFoto(r.dataUrl);
  }

  function alternarBandeira(b: string) {
    setBandeiras((atual) => (atual.includes(b) ? atual.filter((x) => x !== b) : [...atual, b]));
  }

  function alternarPalavraChave(p: string) {
    setPalavrasChave((atual) => {
      if (atual.includes(p)) return atual.filter((x) => x !== p);
      if (atual.length >= 3) return atual;
      return [...atual, p];
    });
  }

  function adicionarPalavraDigitada() {
    const p = novaPalavraChave.trim();
    if (!p || palavrasChave.length >= 3 || palavrasChave.includes(p)) return;
    setPalavrasChave((atual) => [...atual, p]);
    setNovaPalavraChave("");
  }

  function gerarSugestaoBio() {
    const sugestao = gerarBioSugerida({
      cargo,
      disputaPor,
      local: cidadeNome ? `${cidadeNome}/${estadoUf}` : "",
      bandeiras,
      tom,
    });
    if (sugestao) setBio(sugestao);
  }

  function atualizarRede(campo: keyof RedesSociais, valor: string) {
    setRedes((atual) => ({ ...atual, [campo]: valor.trim() || undefined }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // mesmos obrigatórios do onboarding (salvarOnboardingCandidato refaz essa
    // checagem no servidor — aqui é só pra não gastar uma ida e volta à toa)
    if (!nome.trim()) {
      setErro("Precisa do seu nome.");
      return;
    }
    if (!cargo) {
      setErro("Escolha o cargo.");
      return;
    }
    if (!cidadeNome.trim()) {
      setErro("Informe sua região.");
      return;
    }
    setErro("");
    setSalvando(true);

    const resp = await fetch("/api/porta-voz/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        fotoUrl: foto,
        cargo,
        disputaPor,
        anoEleicao,
        localizacao: cidadeNome ? `${cidadeNome}/${estadoUf}` : "",
        bandeiras,
        tomComunicacao: tom,
        palavrasChave,
        redes,
        bio,
        marcaDagua,
        cnpjCampanha,
        tituloEleitor,
      }),
    });
    setSalvando(false);

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setErro(dados?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    router.push("/porta-voz/perfil");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-2xl flex-col gap-9" noValidate>
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      {/* ---- identidade ---- */}
      <section className="reveal flex flex-col gap-5">
        <h2 className={tituloSecao}>Identidade</h2>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
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

            {/* encolher uma foto grande leva um instante; sem sinal a pessoa
                acha que o clique não pegou e tenta de novo */}
            {fotoProcessando && (
              <p className="mt-2 text-[11px] text-muted">Preparando a foto…</p>
            )}
            {erroFoto && (
              <p role="alert" className="mt-2 max-w-[11rem] text-center text-[11px] text-danger">
                {erroFoto}
              </p>
            )}

            {foto && (
              <button
                type="button"
                onClick={() => setFoto(undefined)}
                className="mt-2 text-[11px] text-muted-2 hover:text-muted"
              >
                Remover foto (usar iniciais)
              </button>
            )}
          </div>

          <div className="w-full flex-1">
            <label htmlFor="nome" className={rotuloCampo}>
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
      </section>

      {/* ---- candidatura ---- */}
      <section className="reveal flex flex-col gap-4">
        <h2 className={tituloSecao}>Candidatura</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cargo" className={rotuloCampo}>
              Cargo
            </label>
            <select
              id="cargo"
              className="field-input !pl-4"
              value={cargo}
              onChange={(e) => {
                setCargo(e.target.value);
                setErro("");
              }}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {CARGOS_POLITICOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="disputaPor" className={rotuloCampo}>
              Onde disputa
            </label>
            <select
              id="disputaPor"
              className="field-input !pl-4"
              value={disputaPor}
              onChange={(e) => setDisputaPor(e.target.value)}
            >
              <option value="">Selecione…</option>
              {ESTADOS_BRASIL.map((e) => (
                <option key={e.uf} value={e.nome}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ano" className={rotuloCampo}>
              Ano da eleição
            </label>
            <select
              id="ano"
              className="field-input !pl-4"
              value={anoEleicao}
              onChange={(e) => setAnoEleicao(e.target.value)}
            >
              {ANOS_ELEICAO.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SelectEstadoCidade
          valorEstado={estadoUf}
          valorCidade={cidadeNome}
          onChangeEstado={setEstadoUf}
          onChangeCidade={setCidadeNome}
          labelEstado="Onde você mora"
          labelCidade="Região"
        />
      </section>

      {/* ---- bandeiras ---- */}
      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={tituloSecao}>Bandeiras</h2>
          <p className="mt-1 text-sm text-muted">Os temas que mais representam sua atuação.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {BANDEIRAS_TEMAS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => alternarBandeira(b)}
              aria-pressed={bandeiras.includes(b)}
              className={chip(bandeiras.includes(b))}
            >
              {b}
            </button>
          ))}
        </div>
      </section>

      {/* ---- estilo ---- */}
      <section className="reveal flex flex-col gap-5">
        <div>
          <h2 className={tituloSecao}>Estilo</h2>
          <p className="mt-1 text-sm text-muted">
            Ajuda a Oficina Amarela a te indicar editores com o tom certo.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {TONS_COMUNICACAO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTom(t)}
              aria-pressed={tom === t}
              className={`group rounded-xl border px-4 py-3 text-left transition-colors ${
                tom === t
                  ? "border-gold-lo bg-gold/10"
                  : "border-line bg-surface hover:border-gold/30"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  tom === t ? "text-gold-hi" : "text-muted group-hover:text-text"
                }`}
              >
                {t}
              </span>
              <span className="mt-1 block text-xs italic leading-snug text-muted-2">
                &ldquo;{EXEMPLOS_TOM[t]}&rdquo;
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className={`${rotuloCampo} !mb-1`}>Palavras-chave</p>
          <p className="mb-3 text-xs text-muted-2">Até 3 que definem sua postura.</p>
          <div className="flex flex-wrap gap-2">
            {PALAVRAS_CHAVE_SUGERIDAS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => alternarPalavraChave(p)}
                disabled={palavrasChave.length >= 3 && !palavrasChave.includes(p)}
                aria-pressed={palavrasChave.includes(p)}
                className={chip(palavrasChave.includes(p))}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="field-input !pl-4"
              placeholder="Ou digite a sua…"
              value={novaPalavraChave}
              disabled={palavrasChave.length >= 3}
              onChange={(e) => setNovaPalavraChave(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarPalavraDigitada();
                }
              }}
            />
            <button
              type="button"
              className="btn-ghost w-auto px-4"
              disabled={palavrasChave.length >= 3 || !novaPalavraChave.trim()}
              onClick={adicionarPalavraDigitada}
            >
              Adicionar
            </button>
          </div>
          {palavrasChave.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {palavrasChave.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold-lo bg-gold/10 py-1 pl-3 pr-2 text-xs font-medium text-gold-hi"
                >
                  {p}
                  <button
                    type="button"
                    aria-label={`Remover ${p}`}
                    onClick={() => alternarPalavraChave(p)}
                    className="grid h-4 w-4 place-items-center rounded-full text-gold-hi/70 hover:text-gold-hi"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---- bio ---- */}
      <section className="reveal flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className={tituloSecao}>Biografia</h2>
          <button
            type="button"
            onClick={gerarSugestaoBio}
            className="text-xs font-medium text-gold-hi hover:underline"
          >
            ✨ Gerar sugestão
          </button>
        </div>
        <textarea
          className="field-input !pl-4"
          rows={5}
          placeholder="Fale um pouquinho sobre você…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </section>

      {/* ---- tse ---- */}
      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={tituloSecao}>Regras Eleitorais (TSE)</h2>
          <p className="mt-1 text-sm text-muted">
            Essas informações serão preenchidas automaticamente nas suas missões para que o editor inclua nos vídeos.
          </p>
        </div>
        
        <AvisoTse />

        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          <div>
            <label htmlFor="marcaDagua" className={rotuloCampo}>
              Marca d&apos;água
            </label>
            <input
              id="marcaDagua"
              className="field-input !pl-4"
              placeholder="ex.: Candidato Oficial - #12345"
              value={marcaDagua}
              onChange={(e) => {
                setMarcaDagua(e.target.value);
                setErro("");
              }}
            />
          </div>
          <div>
            <label htmlFor="cnpjCampanha" className={rotuloCampo}>
              CNPJ da Campanha
            </label>
            <input
              id="cnpjCampanha"
              className="field-input !pl-4"
              placeholder="00.000.000/0000-00"
              value={cnpjCampanha}
              onChange={(e) => {
                setCnpjCampanha(e.target.value);
                setErro("");
              }}
            />
          </div>
        </div>
        <div>
          <label htmlFor="tituloEleitor" className={rotuloCampo}>
            Título de Eleitor
          </label>
          <input
            id="tituloEleitor"
            className="field-input !pl-4"
            placeholder="0000 0000 0000"
            value={tituloEleitor}
            onChange={(e) => {
              setTituloEleitor(e.target.value);
              setErro("");
            }}
          />
        </div>
      </section>

      {/* ---- redes ---- */}
      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={tituloSecao}>Redes</h2>
          <p className="mt-1 text-sm text-muted">
            Só o @ ou o link já ajuda. O editor precisa saber onde o vídeo vai ao ar.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative flex items-center">
            <IconInstagram className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="Instagram — @seuperfil"
              value={redes.instagram ?? ""}
              onChange={(e) => atualizarRede("instagram", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconYoutube className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="YouTube — nome do canal"
              value={redes.youtube ?? ""}
              onChange={(e) => atualizarRede("youtube", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconTiktok className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="TikTok — @seuperfil"
              value={redes.tiktok ?? ""}
              onChange={(e) => atualizarRede("tiktok", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconX className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="X — @seuperfil"
              value={redes.x ?? ""}
              onChange={(e) => atualizarRede("x", e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link href="/porta-voz/perfil" className="btn-ghost grid w-32 place-items-center">
          Cancelar
        </Link>
        <button type="submit" className="btn-gold flex-1" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
