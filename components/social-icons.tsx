type IconProps = { className?: string };

export function IconInstagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconYoutube({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10.5 9.3v5.4l4.8-2.7-4.8-2.7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTiktok({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="9.5" cy="16" r="3.3" />
      <path d="M12.8 3v13" strokeLinecap="round" />
      <path d="M12.8 3c.5 2.7 2.4 4.6 5 5" strokeLinecap="round" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 4l16 16M20 4 4 20" strokeLinecap="round" />
    </svg>
  );
}
