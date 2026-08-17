import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dev — Oficina Amarela" };

// Bloqueio visual + lógico: a página de dev nunca deveria existir num build de
// produção. Em produção ela renderiza só um aviso, sem expor nenhum atalho.
const AMBIENTE_DEV = process.env.NODE_ENV === "development" && !process.env.VERCEL;

type Grupo = {
  titulo: string;
  rotulo: string;
  itens: { href: string; titulo: string; desc: string; protegida?: boolean; ok?: boolean }[];
};

const GRUPOS: Grupo[] = [
  {
    titulo: "Públicas",
    rotulo: "Sem login",
    itens: [
      { href: "/", titulo: "Home", desc: "Landing — escolha de papel." },
      { href: "/criar-conta", titulo: "Criar conta", desc: "Início do cadastro (e-mail/senha)." },
      { href: "/login", titulo: "Login", desc: "Entrada com conta existente." },
      { href: "/escolher-papel", titulo: "Escolher papel", desc: "Pós-Google: voz ou editor." },
      { href: "/recuperar", titulo: "Recuperar senha", desc: "Pedido de reset por e-mail." },
      { href: "/redefinir-senha", titulo: "Redefinir senha", desc: "Form com token de reset." },
      { href: "/termos", titulo: "Termos", desc: "Texto legal." },
      { href: "/privacidade", titulo: "Privacidade", desc: "Texto legal." },
    ],
  },
  {
    titulo: "Porta-voz",
    rotulo: "Papel: voz",
    itens: [
      { href: "/porta-voz/criar-perfil", titulo: "Criar perfil (3 etapas)", desc: "Onboarding revisado e aprovado.", protegida: true, ok: true },
      { href: "/porta-voz", titulo: "Painel", desc: "Missões na fila e em andamento. Todo card real abre o detalhe.", protegida: true, ok: true },
      { href: "/porta-voz", titulo: "Detalhe da missão", desc: "Clique num card do painel. Tem linha do tempo, briefing completo e, quando o inspetor libera, os botões de aceitar / pedir ajuste.", protegida: true, ok: true },
      { href: "/porta-voz/nova-pauta", titulo: "Nova missão", desc: "Subir bruto + brief (5 passos). Os 3 campos que antes sumiam (cortes, motivo, prazo) já aparecem no detalhe e pro editor.", protegida: true, ok: true },
      { href: "/porta-voz/perfil", titulo: "Meu perfil", desc: "Perfil do porta-voz — stats e histórico do banco.", protegida: true, ok: true },
      { href: "/porta-voz/perfil/editar", titulo: "Editar perfil do porta-voz", desc: "Edição dedicada (uma página só).", protegida: true, ok: true },
    ],
  },
  {
    titulo: "Editor",
    rotulo: "Papel: editor",
    itens: [
      { href: "/editor/criar-perfil", titulo: "Criar perfil", desc: "Onboarding revisado e aprovado.", protegida: true, ok: true },
      { href: "/editor", titulo: "Fila de missões", desc: "Dispatch estilo Uber: sem lista pra navegar. A missão é oferecida a um editor por vez, com 5 min pra responder. Recusou ou venceu, vai pro próximo.", protegida: true, ok: true },
    ],
  },
  {
    titulo: "Comum / Inspetor",
    rotulo: "Inspetor só admin",
    itens: [
      { href: "/agenda", titulo: "Agenda", desc: "A grade decide de verdade quem recebe oferta: bloco ocupado = nenhuma missão naquele horário. O bloco de agora aparece com anel dourado.", protegida: true, ok: true },
      { href: "/aulas", titulo: "Aulas", desc: "Placeholder — a aba existe no nav, o conteúdo ainda não.", protegida: true },
      { href: "/ranking", titulo: "Ranking", desc: "Editores reais por XP. \"Você\" destaca quem está logado.", protegida: true, ok: true },
      { href: "/perfil", titulo: "Perfil do editor", desc: "Histórico, disponibilidade e mesa agora — tudo do banco.", protegida: true, ok: true },
      { href: "/perfil/editar", titulo: "Editar perfil do editor", desc: "Edita headline, cidade e bio. Foto/softwares/setup ficam no formulário completo — tem link pra lá no rodapé.", protegida: true, ok: true },
      { href: "/inspetor", titulo: "Inspetor", desc: "Fila de entregas pra revisar (admin).", protegida: true },
    ],
  },
];

const PAPEIS = [
  { chave: "voz", rotulo: "Porta-voz", destino: "/porta-voz", cor: "voz" },
  { chave: "editor", rotulo: "Editor", destino: "/editor", cor: "editor" },
  { chave: "admin", rotulo: "Admin", destino: "/inspetor", cor: "admin" },
] as const;

type Passo = { href: string; rotulo: string; auth?: boolean };

function PassoLink({ href, rotulo, auth }: Passo) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-2.5 py-1.5 text-xs text-text transition-colors hover:border-gold/50 hover:bg-surface-2"
    >
      {auth && (
        <span
          className="rounded border border-line px-1 py-px text-[9px] uppercase tracking-wide text-muted-2"
          title="precisa estar logado"
        >
          auth
        </span>
      )}
      <span className="group-hover:text-gold-hi">{rotulo}</span>
      <code className="text-[10px] text-muted-2/70 group-hover:text-gold-hi/70">{href}</code>
    </a>
  );
}

function Fluxo({
  titulo,
  passos,
  tag,
  observacao,
}: {
  titulo: string;
  passos: Passo[];
  tag?: string;
  observacao?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-text">{titulo}</h3>
        {tag && (
          <span className="rounded border border-gold-lo/50 bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold-hi">
            {tag}
          </span>
        )}
      </div>
      {observacao && <p className="mb-2.5 text-[11px] text-muted-2">{observacao}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {passos.map((p, i) => (
          <span key={p.href + i} className="flex items-center gap-1.5">
            <PassoLink {...p} />
            {i < passos.length - 1 && <span className="text-muted-2/60" aria-hidden>›</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DevPage() {
  if (!AMBIENTE_DEV) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <p className="text-sm text-muted">Página de dev disponível só em ambiente de desenvolvimento.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl">
        {/* banner DEV — impossível confundir com produção */}
        <div
          className="mb-8 flex items-center gap-3 rounded-xl border border-gold-lo/60 bg-gold/15 px-4 py-3"
          role="note"
        >
          <span className="inline-block rounded-md bg-gold-lo px-2 py-0.5 font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider text-black">
            Dev
          </span>
          <p className="text-sm text-gold-hi">
            Painel de desenvolvimento. Atalhos, login sem senha e índice de todas as telas.{" "}
            <span className="text-muted-2">Não aparece em produção.</span>
          </p>
        </div>

        <header className="mb-10">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[0.18em] text-text">
            OFICINA AMARELA
          </h1>
          <p className="mt-1 text-sm text-muted">Painel de desenvolvimento — mapa do sistema.</p>
        </header>

        {/* login fake por papel */}
        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.15em] text-muted">
            Entrar como
          </h2>
          <p className="mt-1 mb-4 text-xs text-muted-2">
            Cria/reauma uma conta de teste e te joga direto na área do papel. Sem senha.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PAPEIS.map((p) => (
              <a
                key={p.chave}
                href={`/api/auth/dev-login?papel=${p.chave}`}
                className="group rounded-2xl border border-line bg-surface/70 p-5 transition-colors hover:border-gold/60 hover:bg-surface-2"
              >
                <span className="block font-[family-name:var(--font-display)] text-lg font-semibold text-text group-hover:text-gold-hi">
                  {p.rotulo}
                </span>
                <span className="mt-0.5 block text-xs text-muted-2">
                  entra e vai pra <code className="text-gold-hi">{p.destino}</code>
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* índice por grupo */}
        <section className="mb-10 space-y-8">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.15em] text-muted">
                  {grupo.titulo}
                </h2>
                <span className="text-[11px] text-muted-2">{grupo.rotulo}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.itens.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group rounded-xl border p-4 transition-colors hover:bg-surface-2 ${
                      item.ok
                        ? "border-ok/50 bg-ok/[0.06] hover:border-ok/70"
                        : "border-line bg-surface/50 hover:border-gold/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium ${item.ok ? "text-ok" : "text-text group-hover:text-gold-hi"}`}>
                        {item.titulo}
                      </span>
                      {item.ok ? (
                        <span className="rounded border border-ok/60 bg-ok/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok">
                          ✅ ok
                        </span>
                      ) : item.protegida ? (
                        <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-2">
                          auth
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-snug text-muted-2">{item.desc}</p>
                    <code className="mt-2 block text-[11px] text-muted-2/70">{item.href}</code>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* caminhos do usuário — fluxos encadeados com links diretos */}
        <section className="mb-10">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.15em] text-muted">
            Caminhos do usuário
          </h2>
          <p className="mb-5 text-xs text-muted-2">
            Cada passo é clicável e abre a página real. Os fluxos marcados com{" "}
            <span className="rounded border border-gold-lo/50 bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold-hi">
              login fake
            </span>{" "}
            pulam o cadastro/senha — use pra testar rápido.
          </p>

          <div className="space-y-5">
            <Fluxo
              titulo="Cadasto de Porta-voz (e-mail/senha)"
              passos={[
                { href: "/", rotulo: "Home" },
                { href: "/criar-conta?papel=voz", rotulo: "Criar conta" },
                { href: "/porta-voz/criar-perfil", rotulo: "Criar perfil (3 etapas)", auth: true },
                { href: "/porta-voz", rotulo: "Painel", auth: true },
              ]}
            />
            <Fluxo
              titulo="Cadasto de Editor (e-mail/senha)"
              passos={[
                { href: "/", rotulo: "Home" },
                { href: "/criar-conta?papel=editor", rotulo: "Criar conta" },
                { href: "/editor/criar-perfil", rotulo: "Criar perfil", auth: true },
                { href: "/editor", rotulo: "Fila de missões", auth: true },
              ]}
            />
            <Fluxo
              titulo="Login — Porta-voz"
              tag="login fake"
              passos={[
                { href: "/login", rotulo: "Login" },
                { href: "/api/auth/dev-login?papel=voz", rotulo: "→ entrar fake" },
                { href: "/porta-voz", rotulo: "Painel", auth: true },
                { href: "/porta-voz/nova-pauta", rotulo: "Nova missão", auth: true },
                { href: "/porta-voz/perfil", rotulo: "Meu perfil", auth: true },
              ]}
            />
            <Fluxo
              titulo="Login — Editor"
              tag="login fake"
              passos={[
                { href: "/login", rotulo: "Login" },
                { href: "/api/auth/dev-login?papel=editor", rotulo: "→ entrar fake" },
                { href: "/editor", rotulo: "Fila de missões", auth: true },
                { href: "/agenda", rotulo: "Agenda", auth: true },
                { href: "/ranking", rotulo: "Ranking", auth: true },
                { href: "/perfil", rotulo: "Perfil", auth: true },
              ]}
            />
            <Fluxo
              titulo="Login — Admin (Inspetor)"
              tag="login fake"
              passos={[
                { href: "/api/auth/dev-login?papel=admin", rotulo: "→ entrar fake" },
                { href: "/inspetor", rotulo: "Inspetor (fila de revisão)", auth: true },
              ]}
            />
            <Fluxo
              titulo="Login Google (OAuth)"
              observacao="Precisa de GOOGLE_CLIENT_ID/SECRET reais (hoje dummy no .env)"
              passos={[
                { href: "/login", rotulo: "Login" },
                { href: "/api/auth/google", rotulo: "→ Google consent" },
                { href: "/escolher-papel", rotulo: "Escolher papel (precisa token ?t=)" },
                { href: "/porta-voz/criar-perfil", rotulo: "Criar perfil (pós-escolha)", auth: true },
              ]}
            />
            <Fluxo
              titulo="Recuperar senha"
              observacao="Precisa de RESEND_API_KEY real pra enviar e-mail (hoje dummy)"
              passos={[
                { href: "/login", rotulo: "Login" },
                { href: "/recuperar", rotulo: "Recuperar senha" },
                { href: "/redefinir-senha", rotulo: "Redefinir (precisa token)" },
              ]}
            />
            <Fluxo
              titulo="Perfil público do candidato"
              passos={[
                { href: "/candidato/busnelo", rotulo: "/candidato/busnelo (fake demo)" },
              ]}
            />
          </div>
        </section>

        {/* atalhos de dev */}
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-[0.15em] text-muted">
            Atalhos
          </h2>
          <div className="flex flex-wrap gap-2">
            <a href="/api/auth/logout" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-muted hover:border-gold/40 hover:text-text">
              Sair (logout)
            </a>
            <Link href="/api/auth/sessao" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-muted hover:border-gold/40 hover:text-text">
              Ver sessão atual
            </Link>
            <Link href="/docs/SPEC.md" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-muted hover:border-gold/40 hover:text-text">
              SPEC.md
            </Link>
            <Link href="/docs/PLANO.md" className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-muted hover:border-gold/40 hover:text-text">
              PLANO.md
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
