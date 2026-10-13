export function Card({
  title,
  titulo,
  delay = 0,
  guide,
  guia,
  children,
}: {
  title?: string;
  titulo?: string;
  delay?: number;
  guide?: string;
  guia?: string;
  children: React.ReactNode;
}) {
  const displayTitle = title ?? titulo ?? "";
  const guideTarget = guide ?? guia;
  return (
    <section
      data-guia={guideTarget}
      className="reveal rounded-2xl border border-line-soft bg-surface/80 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_rgba(0,0,0,0.35)] lg:p-6"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* O filete ao lado do título separa o rótulo do conteúdo: antes, com
          o mesmo fundo e a mesma borda do resto, todos os cards liam como um
          bloco só (ver perfil). */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex-none text-xs font-medium uppercase tracking-[0.14em] text-gold">
          {displayTitle}
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-line to-transparent"
        />
      </div>
      {children}
    </section>
  );
}
