import type { DailyChallenge, DesafioDoDia } from "@/lib/gamification-db";

export function DailyChallenges({
  challenges,
  desafios,
}: {
  challenges?: DailyChallenge[];
  desafios?: DesafioDoDia[];
}) {
  const list = challenges ?? (desafios as any) ?? [];
  const completed = list.filter((d: any) => d.completed || d.cumprido).length;
  const earnedXp = list
    .filter((d: any) => d.completed || d.cumprido)
    .reduce((total: number, d: any) => total + d.xp, 0);
  const totalXp = list.reduce((total: number, d: any) => total + d.xp, 0);

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Desafios do dia
          </h2>
          <p className="mt-1 text-xs text-muted-2">
            XP extra por manter o ritmo. Independe da missão que você está fazendo.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gold-hi">+{earnedXp}/{totalXp} XP</span>
          <span className="text-muted">{completed}/{list.length} feitos</span>
        </div>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-300"
          style={{ width: `${list.length ? (completed / list.length) * 100 : 0}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {list.map((d: any) => {
          const isDone = d.completed || d.cumprido;
          const title = d.title ?? d.titulo;
          const description = d.description ?? d.descricao;

          return (
            <article
              key={d.id}
              className={`group flex min-h-40 flex-col rounded-xl border p-4 text-left transition-all ${
                isDone
                  ? "border-ok/40 bg-ok/[0.06]"
                  : "border-line bg-surface/60 hover:-translate-y-0.5 hover:border-gold/40 hover:bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] ${isDone ? "text-ok" : "text-muted-2"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${isDone ? "border-ok bg-ok/15" : "border-line group-hover:border-gold/60"}`}>
                    {isDone ? "✓" : "·"}
                  </span>
                  {isDone ? "feito" : "hoje"}
                </span>
                <span className="rounded-md border border-gold-lo/40 bg-gold/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-gold-hi">
                  +{d.xp} XP
                </span>
              </div>
              <p className={`mt-2 text-sm font-medium ${isDone ? "text-muted line-through" : "text-text"}`}>
                {title}
              </p>
              <p className="mt-1 text-xs text-muted-2">{description}</p>
              <span className={`mt-auto pt-4 text-xs font-medium ${isDone ? "text-ok" : "text-muted-2"}`}>
                {isDone ? "Concluído pela atividade registrada" : "Conclua a ação para liberar o XP"}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export { DailyChallenges as DesafiosDia };
