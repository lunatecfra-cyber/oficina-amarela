export type SemanaEleitoral = {
  semana: string;
  meta: number;
  quantidade: number;
  cumpriu: boolean;
  salvo?: boolean;
};

// semana chega como data pura ("AAAA-MM-DD"), lida em UTC: no fuso do
// Brasil a meia-noite UTC cai no dia anterior (mesmo critério de
// missao-em-maos.tsx)
function dataCurta(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function IconeChama({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M12 3.5s5.2 4 5.2 8.6a5.2 5.2 0 0 1-10.4 0c0-1.7.8-3.2 1.8-4.4.3 1.2 1 2 1.9 2.3.3-2.6.7-4.6 1.5-6.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconeEscudo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6Z" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Progresso do editor no ciclo eleitoral: a semana corrente em primeiro
 * plano (é a pergunta do dia — "quantos faltam essa semana?"), depois a
 * sequência, os bloqueios e o histórico das semanas.
 *
 * Só apresentação: todos os números chegam prontos de `obterProgressoEditor`.
 */
export function ProgressoEleitoral({
  semanas,
  sequencia,
  bloqueios,
  elegivelAoSorteio,
}: {
  semanas: SemanaEleitoral[];
  sequencia: number;
  bloqueios: number;
  elegivelAoSorteio: boolean;
}) {
  // a última semana da lista é a corrente — as anteriores são histórico
  const atual = semanas.length > 0 ? semanas[semanas.length - 1] : null;
  const anteriores = semanas.slice(0, -1);
  const faltam = atual ? Math.max(0, atual.meta - atual.quantidade) : 0;
  const pct = atual ? Math.min(100, Math.round((atual.quantidade / atual.meta) * 100)) : 0;
  const salvasPorBloqueio = semanas.filter((s) => !s.cumpriu && s.salvo).length;
  const BLOQUEIOS_MAX = 2;

  return (
    <div className="flex flex-col gap-4">
      {/* semana corrente: o número que importa agora */}
      {atual ? (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted-2">
              Esta semana
            </span>
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-text">
              <span className={atual.cumpriu ? "text-gold-hi" : "text-text"}>{atual.quantidade}</span>
              <span className="text-muted-2">/{atual.meta}</span>
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full ${
                atual.cumpriu ? "bg-gradient-to-r from-gold-lo to-gold-hi" : "bg-gold/70"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-1.5 text-xs text-muted">
            {atual.cumpriu
              ? "Meta da semana cumprida."
              : faltam === 1
                ? "Falta 1 vídeo aprovado pra fechar a semana."
                : `Faltam ${faltam} vídeos aprovados pra fechar a semana.`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-2">O ciclo ainda não começou a contar semanas.</p>
      )}

      {/* sequência e bloqueios, lado a lado */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line-soft px-3 py-2.5">
          <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
            <IconeChama className="h-4 w-4 text-gold" />
            {sequencia}
          </p>
          <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.04em] text-muted-2">
            {sequencia === 1 ? "semana seguida" : "semanas seguidas"}
          </p>
        </div>

        <div className="rounded-lg border border-line-soft px-3 py-2.5">
          <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
            <IconeEscudo className="h-4 w-4 text-silver" />
            {bloqueios}
            <span className="text-sm font-normal text-muted-2">de {BLOQUEIOS_MAX}</span>
          </p>
          <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.04em] text-muted-2">
            {bloqueios === 1 ? "bloqueio disponível" : "bloqueios disponíveis"}
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-2">
        Um bloqueio é gasto sozinho quando você não fecha a meta da semana — ele
        segura a sequência no lugar em vez de zerar.
        {salvasPorBloqueio > 0 && (
          <>
            {" "}
            <span className="text-silver">
              {salvasPorBloqueio === 1
                ? "1 semana já foi salva assim."
                : `${salvasPorBloqueio} semanas já foram salvas assim.`}
            </span>
          </>
        )}
      </p>

      {/* histórico das semanas anteriores */}
      {anteriores.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.1em] text-muted-2">
            Semanas anteriores
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {anteriores.map((s) => {
              const salva = !s.cumpriu && s.salvo;
              return (
                <li
                  key={s.semana}
                  title={`Semana de ${dataCurta(s.semana)}: ${s.quantidade}/${s.meta} — ${
                    s.cumpriu ? "cumprida" : salva ? "salva por bloqueio" : "não cumprida"
                  }`}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                    s.cumpriu
                      ? "border-gold-lo/50 bg-gold/10 text-gold-hi"
                      : salva
                        ? "border-silver-lo/50 bg-surface-2 text-silver"
                        : "border-line text-muted-2"
                  }`}
                >
                  {dataCurta(s.semana)} · {s.quantidade}/{s.meta}
                  {salva && <span className="ml-1.5 text-silver-lo">· salva</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* elegibilidade ao sorteio */}
      <div
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
          elegivelAoSorteio ? "border-gold-lo/50 bg-gold/[0.07]" : "border-line-soft"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={`mt-0.5 h-4 w-4 flex-none ${elegivelAoSorteio ? "text-gold-hi" : "text-muted-2"}`}
          aria-hidden="true"
        >
          <path d="M12 3.5 14.4 9l5.6.5-4.3 3.8 1.3 5.7L12 16l-5 3 1.3-5.7L4 9.5 9.6 9Z" strokeLinejoin="round" />
        </svg>
        <p className={`text-xs leading-relaxed ${elegivelAoSorteio ? "text-text" : "text-muted"}`}>
          {elegivelAoSorteio ? (
            <>
              <b className="font-medium text-gold-hi">Você está no sorteio por constância.</b>{" "}
              É preciso manter 4 semanas seguidas — você já tem.
            </>
          ) : (
            <>
              Sorteio por constância: some <b className="font-medium text-text">4 semanas seguidas</b>{" "}
              cumprindo a meta pra entrar.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
