import { PREMIOS_ELEITORAIS, type PremioEleitoral } from "@/lib/ranking-eleitoral";

// Ícones no mesmo traço monocromático do resto do projeto (currentColor,
// stroke), pra recolorirem sozinhos conforme o estado do marco.
function IconeIngresso({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v2a2 2 0 0 0 0 3.9v2A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.4v-2a2 2 0 0 0 0-3.9Z" strokeLinejoin="round" />
      <path d="M13 7v11" strokeDasharray="2 2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconeBandeira({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M6 20V4" strokeLinecap="round" />
      <path d="M6 5h11l-3 3.5L17 12H6" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCaneca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" strokeLinejoin="round" />
      <path d="M16 10.5h1.8a2.6 2.6 0 0 1 0 5.2H16" strokeLinecap="round" />
    </svg>
  );
}

function IconeSorteio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M12 3.5 14.4 9l5.6.5-4.3 3.8 1.3 5.7L12 16l-5 3 1.3-5.7L4 9.5 9.6 9Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Embrulho fechado: o que aparece no lugar do ícone de um prêmio ainda secreto. */
function IconePresente({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 10.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" strokeLinejoin="round" />
      <path d="M3 7.5h18v3H3zM12 7.5v13" strokeLinejoin="round" />
      <path d="M12 7.5S10.6 3.5 8.6 3.5a2 2 0 0 0 0 4M12 7.5s1.4-4 3.4-4a2 2 0 0 1 0 4" strokeLinecap="round" />
    </svg>
  );
}

const ICONES: Record<PremioEleitoral, (p: { className?: string }) => React.ReactElement> = {
  ingresso_top1: IconeIngresso,
  bandeira_top2: IconeBandeira,
  caneca_top3: IconeCaneca,
  sorteio_constancia: IconeSorteio,
};

/**
 * Vitrine dos quatro prêmios do ciclo, na ordem em que se abrem conforme a
 * guilda cresce. Três estados bem separados, porque a pergunta que a tela
 * responde é "o que falta pro próximo?":
 *
 * - liberado: já conquistado pela guilda (fundo dourado, marca de confirmado)
 * - próximo:  o primeiro ainda fechado (borda dourada + quantos faltam)
 * - bloqueado: os demais (cinza, sem peso visual)
 *
 * Os prêmios marcados como `segredo` (2º e 3º lugar) escondem o NOME até o
 * marco cair — viram "presente misterioso", com embrulho no lugar do ícone.
 * O marco continua à vista nos três estados: o mistério é o que se ganha,
 * nunca o quanto falta.
 *
 * Quem decide o "liberado" é a lista `premios` que vem do banco — este
 * componente nunca recalcula regra, só desenha.
 */
export function PremiosEleitorais({
  premiosLiberados,
  maiorNumeroDeAtivos,
}: {
  premiosLiberados: readonly PremioEleitoral[];
  maiorNumeroDeAtivos: number;
}) {
  const proximo = PREMIOS_ELEITORAIS.find((p) => !premiosLiberados.includes(p.chave));

  return (
    <ol className="flex flex-col gap-1.5">
      {PREMIOS_ELEITORAIS.map((p) => {
        const liberado = premiosLiberados.includes(p.chave);
        const ehProximo = !liberado && p.chave === proximo?.chave;
        const faltam = Math.max(0, p.ativos - maiorNumeroDeAtivos);
        // segredo cai junto com o marco: destravou, revela o que é
        const oculto = p.segredo && !liberado;
        const Icone = oculto ? IconePresente : ICONES[p.chave];

        return (
          <li
            key={p.chave}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              liberado
                ? "border-gold-lo/50 bg-gold/[0.08]"
                : ehProximo
                  ? "border-gold/40 bg-gold/[0.03]"
                  : "border-line-soft"
            }`}
          >
            <Icone
              className={`h-5 w-5 flex-none ${
                liberado ? "text-gold-hi" : ehProximo ? "text-gold" : "text-muted-2"
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${liberado || ehProximo ? "text-text" : "text-muted"}`}>
                {oculto ? (
                  <span className="italic">Presente misterioso</span>
                ) : (
                  p.premio
                )}{" "}
                <span className="font-normal text-muted-2">· {p.quem}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-2">
                {liberado
                  ? "liberado"
                  : ehProximo
                    ? `faltam ${faltam} ${faltam === 1 ? "editor ativo" : "editores ativos"}`
                    : `a partir de ${p.ativos} ativos`}
                {oculto && <span className="text-muted-2"> · revelado ao destravar</span>}
              </p>
            </div>

            {liberado ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                className="h-4 w-4 flex-none text-gold-hi"
                aria-label="liberado"
              >
                <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : ehProximo ? (
              <span className="flex-none rounded-full border border-gold/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-gold">
                próximo
              </span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4 flex-none text-muted-2"
                aria-label="bloqueado"
              >
                <rect x="5" y="10.5" width="14" height="9" rx="2" />
                <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" strokeLinecap="round" />
              </svg>
            )}
          </li>
        );
      })}
    </ol>
  );
}
