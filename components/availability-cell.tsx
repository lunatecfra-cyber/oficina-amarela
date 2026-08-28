export function AvailabilityCell({
  free: freeProp,
  isFree,
  livre,
  label,
  size = "normal",
  onClick,
  className = "",
}: {
  free?: boolean;
  isFree?: boolean;
  livre?: boolean;
  label: string;
  size?: "normal" | "mini";
  onClick?: () => void;
  className?: string;
}) {
  const free = freeProp ?? isFree ?? livre ?? false;
  const mini = size === "mini";
  const dimension = mini ? "h-5 rounded-sm" : "h-9 rounded-md";
  const color = free
    ? `bg-gradient-to-b from-gold to-gold-lo ${mini ? "" : "border border-gold"}`
    : `border border-line bg-ink-2 ${mini ? "" : "hover:border-silver-lo"}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={free}
        aria-label={label}
        className={`${dimension} ${color} ${className} transition-colors`}
      />
    );
  }

  return <span title={label} className={`${dimension} ${color} ${className}`} />;
}

export { AvailabilityCell as CelulaDisponibilidade };
