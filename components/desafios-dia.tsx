import type { DesafioDoDia } from "@/lib/gamificacao-db";

export function DesafiosDia({ desafios }: { desafios: DesafioDoDia[] }) {

  const feitos = desafios.filter((d) => d.cumprido).length;
  const xpFeito = desafios.filter((d) => d.cumprido).reduce((total, d) => total + d.xp, 0);
  const xpTotal = desafios.reduce((total, d) => total + d.xp, 0);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* "encomenda" era vocabulário solto: em tela tudo é missão */}
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Desafios do dia
          </h2>
          <p className="mt-1 text-xs text-muted-2">
            XP extra por manter o ritmo. Independe da missão que você está fazendo.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gold-hi">+{xpFeito}/{xpTotal} XP</span>
          <span className="text-muted">{feitos}/{desafios.length} feitos</span>
        </div>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-300"
          style={{ width: `${desafios.length ? (feitos / desafios.length) * 100 : 0}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {desafios.map((d) => (
          <article
            key={d.id}
            className={`group flex min-h-40 flex-col rounded-xl border p-4 text-left transition-all ${
              d.cumprido
                ? "border-ok/40 bg-ok/[0.06]"
                : "border-line bg-surface/60 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-surface-2"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] ${d.cumprido ? "text-ok" : "text-muted-2"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${d.cumprido ? "border-ok bg-ok/15" : "border-line group-hover:border-gold/60"}`}>
                  {d.cumprido ? "✓" : "·"}
                </span>
                {d.cumprido ? "feito" : "hoje"}
              </span>
              <span className="rounded-md border border-gold-lo/40 bg-gold/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-gold-hi">
                +{d.xp} XP
              </span>
            </div>
            <p className={`mt-2 text-sm font-medium ${d.cumprido ? "text-muted line-through" : "text-text"}`}>
              {d.titulo}
            </p>
            <p className="mt-1 text-xs text-muted-2">{d.descricao}</p>
            <span className={`mt-auto pt-4 text-xs font-medium ${d.cumprido ? "text-ok" : "text-muted-2"}`}>
              {d.cumprido ? "Concluído pela atividade registrada" : "Conclua a ação para liberar o XP"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
