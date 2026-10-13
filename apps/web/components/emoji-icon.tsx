import {
  CalendarClock,
  Check,
  CircleCheck,
  CirclePlay,
  Clapperboard,
  Cog,
  Flame,
  FolderOpen,
  Link2,
  Lock,
  type LucideIcon,
  Medal,
  MessageCircle,
  MousePointerClick,
  Music,
  Palette,
  Play,
  Rocket,
  Scissors,
  Send,
  Smartphone,
  Square,
  Star,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
  Turtle,
  Upload,
  Volume2,
  Zap,
} from "lucide-react";

/**
 * O dicionário da troca emoji → Lucide.
 *
 * Os emojis moram nos DADOS (coluna `icon` de conquistas, `label` do setup,
 * `text` do status da missão), então o banco continua guardando os mesmos
 * valores — só o desenho muda, aqui na borda da apresentação. Por isso as
 * chaves estão sem o seletor de variação (U+FE0F): a busca normaliza antes.
 *
 * O 🐆 NÃO está aqui de propósito: é o mascote, não enfeite. Se um valor
 * desconhecido chegar (incluindo a onça), o `EmojiIcon` devolve o texto cru.
 */
const MAP: Record<string, LucideIcon> = {
  "🔥": Flame,
  "⚡": Zap,
  "🎯": Target,
  "🎵": Music,
  "🔊": Volume2,
  "✂": Scissors,
  "🎨": Palette,
  "🏆": Trophy,
  "🎬": Clapperboard,
  "🏅": Medal,
  "🚀": Rocket,
  "📱": Smartphone,
  "🥔": Turtle,
  "⚙": Cog,
  "📨": Send,
  "💬": MessageCircle,
  "🔍": CirclePlay,
  "✅": CircleCheck,
  "✔": Check,
  "✓": Check,
  "⏳": Timer,
  "⏰": CalendarClock,
  "📁": FolderOpen,
  "▶": Play,
  "⏹": Square,
  "⭐": Star,
  "⚠": TriangleAlert,
  "👆": MousePointerClick,
  "⬆": Upload,
  "🔒": Lock,
  "🔗": Link2,
};

function normalize(value: string): string {
  return value.replace(/[\uFE0E\uFE0F]/g, "").trim();
}

/**
 * Um valor de ícone vindo do banco ou do domínio: devolve o Lucide
 * correspondente ou, se não houver (mascote, valor novo), o texto original.
 */
export function EmojiIcon({ value, className }: { value?: string | null; className?: string }) {
  const Icon = value ? MAP[normalize(value)] : undefined;
  if (!Icon) {
    return (
      <span className={className} aria-hidden="true">
        {value}
      </span>
    );
  }
  return <Icon className={className} aria-hidden="true" />;
}

const LEAD_PATTERN = new RegExp(
  `^(${Object.keys(MAP)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?:\uFE0F|\u200D)?\\s*`,
  "u",
);

/**
 * Separa o emoji da frente ("🎬 Edição iniciada" → ["🎬", "Edição iniciada"]).
 * Sem emoji na frente, devolve [null, texto intacto].
 */
export function splitLead(text: string): [string | null, string] {
  const m = text.match(LEAD_PATTERN);
  if (!m) return [null, text];
  return [m[1], text.slice(m[0].length)];
}

/**
 * Texto do domínio com emoji na frente, pronto pra tela: ícone Lucide +
 * resto do texto, sem tocar no valor guardado.
 */
export function EmojiLead({
  text,
  className,
  iconClassName,
}: {
  text: string;
  className?: string;
  iconClassName?: string;
}) {
  const [lead, rest] = splitLead(text);
  if (!lead) return <span className={className}>{text}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <EmojiIcon value={lead} className={iconClassName ?? "h-4 w-4 flex-none"} />
      <span>{rest}</span>
    </span>
  );
}
