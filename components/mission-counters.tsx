import {
  SPOKESPERSON_BUCKET_LABEL,
  spokespersonBucket,
  type Mission,
  type SpokespersonBucket,
} from "@/lib/missions";

const ORDER = ["waiting_editor", "editing", "reviewing", "done"] as const;

/**
 * Os quatro números do porta-voz, numa faixa só.
 *
 * Aparece no início e no perfil: são a MESMA conta, e ver dois totais
 * diferentes pra mesma coisa é o tipo de detalhe que faz a pessoa desconfiar
 * da tela inteira. Por isso mora aqui, e não copiado nas duas.
 */
export function MissionCounters({ missions }: { missions: Mission[] }) {
  const counts: Record<SpokespersonBucket, number> = {
    waiting_editor: 0,
    editing: 0,
    reviewing: 0,
    done: 0,
  };
  for (const m of missions) counts[spokespersonBucket(m.status)] += 1;

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface/50 sm:grid-cols-4">
      {ORDER.map((key, i) => (
        <div
          key={key}
          className={`px-4 py-3.5 ${i % 2 === 1 ? "border-l border-line-soft" : ""} ${
            i >= 2 ? "border-t border-line-soft sm:border-t-0" : ""
          } ${i >= 2 ? "sm:border-l" : ""}`}
        >
          <dd
            className={`font-[family-name:var(--font-display)] text-2xl font-semibold ${
              counts[key] > 0 ? "text-text" : "text-muted-2"
            }`}
          >
            {counts[key]}
          </dd>
          <dt className="mt-0.5 text-xs leading-tight text-muted">
            {SPOKESPERSON_BUCKET_LABEL[key]}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export { MissionCounters as ContadoresMissoes };
