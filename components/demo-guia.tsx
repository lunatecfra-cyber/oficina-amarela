import type { Demo } from "@/lib/guia";

/**
 * As demonstraçõezinhas que rodam dentro do balão do guia.
 *
 * Não são vídeo. Vídeo teria que ser hospedado, baixado e mantido — e a regra
 * da casa é que vídeo nenhum mora no nosso servidor. Isto aqui é HTML e CSS:
 * pesa alguns bytes, funciona sem rede depois que a página abriu e não
 * envelhece quando o Drive mudar de cor.
 *
 * O ritmo é do CSS (`.guia-palco` no globals.css). Aqui só entram as cenas e
 * o atraso de cada uma — negativo, pra cena 2 já começar no ponto dela.
 */

const CICLO = { drive: 9.6, entrega: 7.2 } as const;

function Cena({
  indice,
  total,
  ciclo,
  children,
}: {
  indice: number;
  total: number;
  ciclo: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="guia-cena"
      style={{ animationDelay: `${-(ciclo - (ciclo / total) * indice)}s` }}
    >
      {children}
    </div>
  );
}

function Legenda({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="text-center text-[11px] leading-snug text-muted">
      <span className="mr-1 font-semibold text-gold">{n}.</span>
      {children}
    </p>
  );
}

/** pastinha com três fitas de vídeo dentro */
function Pasta({ rotulo }: { rotulo: string }) {
  return (
    <div className="w-[150px] rounded-lg border border-line bg-surface/80 p-2">
      <p className="mb-1.5 truncate text-[10px] text-muted-2">📁 {rotulo}</p>
      <div className="flex flex-col gap-1">
        {[100, 74, 88].map((larg, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full bg-gradient-to-r from-gold-lo/70 to-gold-lo/20"
            style={{ width: `${larg}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** um botão de mentira, com o dedo tocando nele */
function BotaoFalso({ texto, comDedo }: { texto: string; comDedo?: boolean }) {
  return (
    <span className="relative inline-flex items-center rounded-lg bg-gradient-to-b from-gold-hi to-gold-lo px-3 py-1.5 text-[11px] font-semibold text-black/80">
      {texto}
      {comDedo && (
        <span
          aria-hidden="true"
          className="guia-toque absolute -bottom-3 -right-3 text-base"
        >
          👆
        </span>
      )}
    </span>
  );
}

/** o seletor de acesso do Drive, do fechado pro aberto */
function Acesso() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-md border border-line bg-ink-2 px-2 py-1 text-[10px] text-muted-2 line-through">
        🔒 Restrito
      </span>
      <span aria-hidden="true" className="text-[10px] text-gold">
        ↓
      </span>
      <span className="rounded-md border border-gold-lo/60 bg-gold/10 px-2 py-1 text-[10px] font-medium text-gold-hi">
        🔗 Qualquer pessoa com o link
      </span>
    </div>
  );
}

/** o campo do formulário recebendo o link */
function CampoColado({ botao }: { botao?: string }) {
  return (
    <div className="flex w-[170px] flex-col gap-1.5">
      <span className="flex items-center gap-1 rounded-lg border border-gold/50 bg-surface px-2 py-1.5 text-[10px] text-text">
        <span className="truncate">drive.google.com/…</span>
        <span className="text-ok">✓</span>
      </span>
      {botao && <BotaoFalso texto={botao} />}
    </div>
  );
}

export function DemoGuia({ tipo }: { tipo: Demo }) {
  if (tipo === "drive") {
    const c = CICLO.drive;
    return (
      <div className="guia-palco mt-3" data-cenas="4" aria-hidden="true">
        <Cena indice={0} total={4} ciclo={c}>
          <Pasta rotulo="Brutos da semana" />
          <Legenda n={1}>Suba o vídeo na sua pasta do Drive</Legenda>
        </Cena>
        <Cena indice={1} total={4} ciclo={c}>
          <BotaoFalso texto="Compartilhar" comDedo />
          <Legenda n={2}>Abra a pasta e toque em Compartilhar</Legenda>
        </Cena>
        <Cena indice={2} total={4} ciclo={c}>
          <Acesso />
          <Legenda n={3}>Troque de “Restrito” pra “qualquer pessoa”</Legenda>
        </Cena>
        <Cena indice={3} total={4} ciclo={c}>
          <CampoColado />
          <Legenda n={4}>Copie o link e cole aqui</Legenda>
        </Cena>
      </div>
    );
  }

  const c = CICLO.entrega;
  return (
    <div className="guia-palco mt-3" data-cenas="3" aria-hidden="true">
      <Cena indice={0} total={3} ciclo={c}>
        <Pasta rotulo="Meus vídeos prontos" />
        <Legenda n={1}>O vídeo pronto sobe no SEU Drive</Legenda>
      </Cena>
      <Cena indice={1} total={3} ciclo={c}>
        <Acesso />
        <Legenda n={2}>Libere pra quem tem o link</Legenda>
      </Cena>
      <Cena indice={2} total={3} ciclo={c}>
        <CampoColado botao="Confirmar entrega" />
        <Legenda n={3}>Cole aqui e confirme</Legenda>
      </Cena>
    </div>
  );
}
