import { proximityColor, corProximidade } from "@/lib/candidates";

export function ProximityLocation({
  location,
  proximity,
  local,
  proximidade,
  className,
}: {
  location?: string;
  proximity?: number;
  local?: string;
  proximidade?: number;
  className?: string;
}) {
  const effectiveLocation = location ?? local ?? "";
  const effectiveProximity = proximity ?? proximidade ?? 0;
  const color = proximityColor(effectiveProximity);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{ background: color, boxShadow: `0 0 6px color-mix(in srgb, ${color} 47%, transparent)` }}
        title={`Proximidade: ${Math.round(effectiveProximity * 100)}%`}
        aria-hidden="true"
      />
      {effectiveLocation}
    </span>
  );
}

export { ProximityLocation as LocalProximidade };
