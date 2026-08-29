import { ELECTORAL_AWARDS, type ElectoralAward, type PremioEleitoral } from "@/lib/electoral-ranking";

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v2a2 2 0 0 0 0 3.9v2A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.4v-2a2 2 0 0 0 0-3.9Z" strokeLinejoin="round" />
      <path d="M13 7v11" strokeDasharray="2 2.4" strokeLinecap="round" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M6 20V4" strokeLinecap="round" />
      <path d="M6 5h11l-3 3.5L17 12H6" strokeLinejoin="round" />
    </svg>
  );
}

function MugIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" strokeLinejoin="round" />
      <path d="M16 10.5h1.8a2.6 2.6 0 0 1 0 5.2H16" strokeLinecap="round" />
    </svg>
  );
}

function DrawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M12 3.5 14.4 9l5.6.5-4.3 3.8 1.3 5.7L12 16l-5 3 1.3-5.7L4 9.5 9.6 9Z" strokeLinejoin="round" />
    </svg>
  );
}

function MysteryGiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 10.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" strokeLinejoin="round" />
      <path d="M3 7.5h18v3H3zM12 7.5v13" strokeLinejoin="round" />
      <path d="M12 7.5S10.6 3.5 8.6 3.5a2 2 0 0 0 0 4M12 7.5s1.4-4 3.4-4a2 2 0 0 1 0 4" strokeLinecap="round" />
    </svg>
  );
}

const AWARD_ICONS: Record<ElectoralAward, (p: { className?: string }) => React.ReactElement> = {
  ingresso_top1: TicketIcon,
  bandeira_top2: FlagIcon,
  caneca_top3: MugIcon,
  sorteio_constancia: DrawIcon,
};

/**
 * Visual showcase of the four electoral cycle awards in unlock order.
 * All public text is preserved in Portuguese (PT-BR).
 */
export function ElectoralAwards({
  unlockedAwards,
  premiosLiberados,
  highestActiveCount,
  maiorNumeroDeAtivos,
}: {
  unlockedAwards?: readonly ElectoralAward[];
  premiosLiberados?: readonly PremioEleitoral[];
  highestActiveCount?: number;
  maiorNumeroDeAtivos?: number;
}) {
  const awardsList = unlockedAwards ?? premiosLiberados ?? [];
  const activeMilestone = highestActiveCount ?? maiorNumeroDeAtivos ?? 0;
  const nextAward = ELECTORAL_AWARDS.find((p) => !awardsList.includes(p.key));

  return (
    <ol className="flex flex-col gap-1.5">
      {ELECTORAL_AWARDS.map((p) => {
        const isUnlocked = awardsList.includes(p.key);
        const isNext = !isUnlocked && p.key === nextAward?.key;
        const missingCount = Math.max(0, p.activeThreshold - activeMilestone);
        const isHidden = p.isSecret && !isUnlocked;
        const Icon = isHidden ? MysteryGiftIcon : AWARD_ICONS[p.key];

        return (
          <li
            key={p.key}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              isUnlocked
                ? "border-gold-lo/50 bg-gold/[0.08]"
                : isNext
                  ? "border-gold/40 bg-gold/[0.03]"
                  : "border-line-soft"
            }`}
          >
            <Icon
              className={`h-5 w-5 flex-none ${
                isUnlocked ? "text-gold-hi" : isNext ? "text-gold" : "text-muted-2"
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${isUnlocked || isNext ? "text-text" : "text-muted"}`}>
                {isHidden ? (
                  <span className="italic">Presente misterioso</span>
                ) : (
                  p.award
                )}{" "}
                <span className="font-normal text-muted-2">· {p.target}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-2">
                {isUnlocked
                  ? "liberado"
                  : isNext
                    ? `faltam ${missingCount} ${missingCount === 1 ? "editor ativo" : "editores ativos"}`
                    : `a partir de ${p.activeThreshold} ativos`}
                {isHidden && <span className="text-muted-2"> · revelado ao destravar</span>}
              </p>
            </div>

            {isUnlocked ? (
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
            ) : isNext ? (
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

export const PremiosEleitorais = ElectoralAwards;
