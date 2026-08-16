"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { iniciais } from "@/lib/candidatos";
import type { Papel } from "@/lib/sessao";

type UsuarioLista = {
  id: number;
  apelido: string;
  nome: string;
  email: string;
  papel: Papel;
  banido: boolean;
  perfilCompleto: boolean;
  criadoEm: string;
};

type DetalheUsuario = UsuarioLista & {
  fotoUrl: string | null;
  localizacao: string | null;
  bio: string | null;
  entregues: number;
  reputacao: number;
  streak: number;
  nota: number | null;
  cargo: string | null;
  disputaPor: string | null;
  anoEleicao: string | null;
  banidoEm: string | null;
  motivoBanimento: string | null;
  pautasAtivas: number;
};

const ROTULO_PAPEL: Record<Papel, string> = {
  voz: "Candidato",
  editor: "Editor",
  admin: "Inspetor",
};

function formatarData(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PainelContas() {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<UsuarioLista[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<DetalheUsuario | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (termo: string) => {
    setCarregando(true);
    setErro("");
    try {
      const resp = await fetch(`/api/admin/usuarios?q=${encodeURIComponent(termo)}`);
      if (!resp.ok) {
        const dados = await resp.json().catch(() => null);
        setErro(dados?.erro ?? "Busca falhou.");
        return;
      }
      const dados = (await resp.json()) as { usuarios: UsuarioLista[] };
      setResultados(dados.usuarios);
    } catch {
      setErro("Sem conexão. Tenta de novo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // busca inicial (sem termo = mais recentes) e debounce nas mudanças.
  // buscar() é async: o setState acontece depois do await, não de forma
  // síncrona no corpo do effect — o aviso do linter aqui é falso-positivo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void buscar("");
  }, [buscar]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void buscar(busca), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca, buscar]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Gerenciar Pessoas
          </h1>
          <p className="mt-1 text-sm text-muted">
            Veja contas, confirme candidatos e suspenda quem precisar.
          </p>
        </div>
      </div>

      <div className="mt-6" data-guia="busca-pessoas">
        <label htmlFor="busca-pessoas" className="sr-only">
          Buscar pessoas
        </label>
        <input
          id="busca-pessoas"
          type="search"
          autoComplete="off"
          className="field-input"
          placeholder="Buscar por nome, apelido ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {erro}
        </p>
      )}

      {/* min-w-0 nos dois filhos da grade não é enfeite: item de grid tem
          min-width:auto, ou seja, não encolhe abaixo do próprio min-content.
          O e-mail de cada linha é `truncate` (nowrap), então o min-content da
          lista virava a largura do e-mail MAIS COMPRIDO — 506px. No celular a
          coluna nascia com 506, o Chrome esticava a viewport pra 526 e a tela
          inteira aparecia cortada na direita: cartões sem borda, e-mails sem
          reticências e os botões de banir/apagar fora do alcance. Com min-w-0
          a coluna passa a valer 350 e o truncate volta a fazer o trabalho. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="flex min-w-0 flex-col gap-2">
          {carregando && resultados.length === 0 && (
            <li className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Carregando…
            </li>
          )}
          {!carregando && resultados.length === 0 && (
            <li className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Ninguém encontrado.
            </li>
          )}
          {resultados.map((u) => (
            <LinhaUsuario
              key={u.id}
              usuario={u}
              ativo={selecionado?.id === u.id}
              onClick={() => void abrirDetalhe(u.id, setSelecionado, setErro)}
            />
          ))}
        </ul>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {selecionado ? (
            <PainelDetalhe
              detalhe={selecionado}
              onAtualizado={(novo) => setSelecionado(novo)}
              onApagado={() => {
                // tira da lista na hora, sem esperar nova busca: a conta não
                // existe mais e clicar nela de novo daria erro
                setResultados((lista) => lista.filter((u) => u.id !== selecionado.id));
                setSelecionado(null);
              }}
            />
          ) : (
            <div className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
              Selecione alguém pra ver a conta.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

async function abrirDetalhe(
  id: number,
  setDetalhe: (d: DetalheUsuario | null) => void,
  setErro: (m: string) => void
) {
  try {
    const resp = await fetch(`/api/admin/usuarios/${id}`);
    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setErro(dados?.erro ?? "Não deu pra abrir a conta.");
      return;
    }
    const dados = (await resp.json()) as { usuario: DetalheUsuario };
    setDetalhe(dados.usuario);
    setErro("");
  } catch {
    setErro("Sem conexão. Tenta de novo.");
  }
}

function LinhaUsuario({
  usuario: u,
  ativo,
  onClick,
}: {
  usuario: UsuarioLista;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors lg:p-4 ${
          ativo
            ? "border-gold/60 bg-gold/5"
            : "border-line bg-surface/70 hover:border-gold/30 hover:bg-surface"
        }`}
      >
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-ink-2 font-[family-name:var(--font-display)] text-sm font-semibold text-gold-hi">
          {iniciais(u.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-text">{u.nome}</p>
            {u.banido && <SeloBanido />}
          </div>
          <p className="truncate text-xs text-muted">
            @{u.apelido} · {u.email}
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-[11px] text-muted">
            {ROTULO_PAPEL[u.papel]}
          </span>
          {!u.perfilCompleto && (
            <span className="text-[10px] text-muted-2">perfil incompleto</span>
          )}
        </div>
      </button>
    </li>
  );
}

function SeloBanido() {
  return (
    <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
      suspenso
    </span>
  );
}

function PainelDetalhe({
  detalhe: d,
  onAtualizado,
  onApagado,
}: {
  detalhe: DetalheUsuario;
  onAtualizado: (novo: DetalheUsuario) => void;
  /** conta apagada some do painel: quem chama tira da lista e fecha o detalhe */
  onApagado: () => void;
}) {
  const [confirmando, setConfirmando] = useState<null | "banir" | "desbanir" | "apagar">(null);
  const [motivo, setMotivo] = useState("");
  const [apelidoDigitado, setApelidoDigitado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  // Apagar não volta. Banir dá pra desfazer com um clique; isto some com a
  // conta, com o histórico e com a nota da pessoa. Digitar o apelido é o que
  // separa "quis apagar" de "clicou no botão errado" — o mesmo cuidado que a
  // exclusão da própria conta já pede.
  const apelidoConfere =
    apelidoDigitado.trim().toLowerCase() === d.apelido.toLowerCase();

  async function confirmar() {
    if (confirmando === "apagar" && !apelidoConfere) {
      setAviso("Digite o apelido exatamente como aparece acima.");
      return;
    }
    setSalvando(true);
    setAviso("");
    try {
      const resp = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          confirmando === "banir"
            ? { userId: d.id, acao: "banir", motivo }
            : confirmando === "apagar"
              ? { userId: d.id, acao: "apagar" }
              : { userId: d.id, acao: "desbanir" }
        ),
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => null);
        setAviso(dados?.erro ?? "Não deu pra concluir.");
        return;
      }

      // conta apagada não tem detalhe pra recarregar: volta pra lista
      if (confirmando === "apagar") {
        onApagado();
        return;
      }

      // recarrega o detalhe pra refletir o novo estado
      const det = await fetch(`/api/admin/usuarios/${d.id}`);
      if (det.ok) {
        const novo = (await det.json()) as { usuario: DetalheUsuario };
        onAtualizado(novo.usuario);
      }
      setConfirmando(null);
      setMotivo("");
    } catch {
      setAviso("Sem conexão. Tenta de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const ehCandidato = d.papel === "voz" && (!!d.cargo || !!d.disputaPor);
  const ehAdmin = d.papel === "admin";

  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-ink-2 font-[family-name:var(--font-display)] text-base font-semibold text-gold-hi">
          {iniciais(d.nome)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {d.nome}
            </h2>
            {d.banido && <SeloBanido />}
          </div>
          <p className="truncate text-xs text-muted">@{d.apelido}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Detalhe rotulo="Papel" valor={ROTULO_PAPEL[d.papel]} />
        <Detalhe rotulo="E-mail" valor={d.email} />
        {d.localizacao && <Detalhe rotulo="Região" valor={d.localizacao} />}
        <Detalhe rotulo="Conta criada" valor={formatarData(d.criadoEm)} />
        {d.papel === "editor" && (
          <>
            <Detalhe rotulo="Entregues" valor={String(d.entregues)} />
            <Detalhe rotulo="Reputação" valor={String(d.reputacao)} />
            <Detalhe rotulo="Streak" valor={String(d.streak)} />
            <Detalhe rotulo="Nota" valor={d.nota === null ? "—" : d.nota.toFixed(2)} />
            <Detalhe rotulo="Missões ativas" valor={String(d.pautasAtivas)} />
          </>
        )}
        {ehCandidato && (
          <>
            <Detalhe rotulo="Cargo" valor={d.cargo ?? ""} />
            {d.disputaPor && <Detalhe rotulo="Disputa" valor={d.disputaPor} />}
            {d.anoEleicao && <Detalhe rotulo="Ano" valor={d.anoEleicao} />}
          </>
        )}
        {d.papel === "voz" && !ehCandidato && (
          <p className="rounded-lg border border-line-soft bg-ink-2/50 px-3 py-2 text-xs text-muted">
            Candidato sem perfil preenchido.
          </p>
        )}
      </dl>

      {d.banido && d.motivoBanimento && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-danger/80">Motivo da suspensão</p>
          <p className="mt-1 text-sm text-text">{d.motivoBanimento}</p>
          {d.banidoEm && (
            <p className="mt-1 text-xs text-muted">Desde {formatarData(d.banidoEm)}</p>
          )}
        </div>
      )}

      {aviso && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {aviso}
        </p>
      )}

      {/* Admin não aparece botão de banir — o guard em banirUsuario já impede,
          e mostrar o botão só pra falhar seria cruel com o inspetor. */}
      {!ehAdmin && !confirmando && (
        <div className="mt-5 flex gap-2">
          {d.banido ? (
            <button
              className="btn-gold flex-1"
              onClick={() => setConfirmando("desbanir")}
              disabled={salvando}
            >
              Desbanir
            </button>
          ) : (
            <button
              className="btn-ghost flex-1 !border-danger/40 !text-danger hover:!bg-danger/10"
              onClick={() => setConfirmando("banir")}
              disabled={salvando}
            >
              Banir
            </button>
          )}

          {/* Apagar fica ao lado do banir, mas discreto de propósito: banir
              resolve quase todo caso e dá pra desfazer. Isto some com a conta,
              o histórico e a nota da pessoa, pra sempre. */}
          <button
            className="btn-ghost w-32 !text-muted-2 hover:!border-danger/40 hover:!text-danger"
            onClick={() => {
              setConfirmando("apagar");
              setApelidoDigitado("");
              setAviso("");
            }}
            disabled={salvando}
          >
            Apagar
          </button>
        </div>
      )}

      {confirmando === "apagar" && (
        <div className="mt-5 rounded-xl border border-danger/40 bg-danger/[0.06] p-3">
          <p className="text-sm text-text">
            Apagar a conta de <b>{d.apelido}</b> não tem volta. Some o cadastro,
            o histórico de entregas e a nota.
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Missão que essa pessoa tiver em mãos volta pra fila. O que já foi
            entregue e está em revisão continua com você.
          </p>
          <p className="mt-3 text-xs text-muted">
            Se for só afastar por um tempo, <b>Banir</b> resolve e dá pra desfazer.
          </p>

          <label
            htmlFor="confirmar-apelido"
            className="mt-3 mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            Digite {d.apelido} pra confirmar
          </label>
          <input
            id="confirmar-apelido"
            className="field-input !pl-4"
            value={apelidoDigitado}
            onChange={(e) => {
              setApelidoDigitado(e.target.value);
              setAviso("");
            }}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1 !border-danger/50 !text-danger hover:!bg-danger/10"
              onClick={confirmar}
              disabled={salvando || !apelidoConfere}
            >
              {salvando ? "Apagando…" : "Apagar pra sempre"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => {
                setConfirmando(null);
                setApelidoDigitado("");
                setAviso("");
              }}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmando === "banir" && (
        <div className="mt-5 rounded-xl border border-line bg-ink-2/40 p-3">
          <label
            htmlFor="motivo-banimento"
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            Motivo da suspensão
          </label>
          <textarea
            id="motivo-banimento"
            className="field-input !pl-4 min-h-24 resize-y"
            placeholder="Por que suspender essa conta? (visível só ao inspetor)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
          />
          <div className="mt-3 flex gap-2">
            <button
              className="btn-gold flex-1"
              onClick={confirmar}
              disabled={salvando || !motivo.trim()}
            >
              {salvando ? "Suspensendo…" : "Confirmar suspensão"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => {
                setConfirmando(null);
                setMotivo("");
              }}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmando === "desbanir" && (
        <div className="mt-5 rounded-xl border border-line bg-ink-2/40 p-3">
          <p className="text-sm text-text">
            Reabrir a conta de <strong>{d.nome}</strong>? Ela volta a poder entrar.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-gold flex-1" onClick={confirmar} disabled={salvando}>
              {salvando ? "Reabrindo…" : "Sim, desbanir"}
            </button>
            <button
              className="btn-ghost w-32"
              onClick={() => setConfirmando(null)}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-2">{rotulo}</dt>
      <dd className="text-right text-text">{valor}</dd>
    </div>
  );
}
