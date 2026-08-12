export function CelulaDisponibilidade({
  livre,
  label,
  size = "normal",
  onClick,
  className = "",
}: {
  livre: boolean;
  label: string;
  size?: "normal" | "mini";
  onClick?: () => void;
  /** extras de estilo (ex.: o anel que marca o bloco de agora).
   *  Vem por prop de propósito: a célula é filha direta do grid e é ela que
   *  estica pra largura da coluna — envolver num <div> a faria encolher. */
  className?: string;
}) {
  const mini = size === "mini";
  const dimensao = mini ? "h-5 rounded-sm" : "h-9 rounded-md";
  const cor = livre
    ? `bg-gradient-to-b from-gold to-gold-lo ${mini ? "" : "border border-gold"}`
    : `border border-line bg-ink-2 ${mini ? "" : "hover:border-silver-lo"}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={livre}
        aria-label={label}
        className={`${dimensao} ${cor} ${className} transition-colors`}
      />
    );
  }

  return <span title={label} className={`${dimensao} ${cor} ${className}`} />;
}
