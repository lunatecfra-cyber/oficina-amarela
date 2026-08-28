import { sql } from "@/lib/db";
import { LIMITS, isValidPhoto, limitStr, limitList, limitOrNull } from "@/lib/limits";
import type {
  EditorRanking,
  HistoryItem,
  PortfolioItem,
  Tier,
  EditorProfile,
} from "@/lib/profile";

export type EditableProfile = {
  headline: string[];
  bio: string | null;
  location: string | null;
  // aliases
  localizacao?: string | null;
};
export type PerfilEditavel = EditableProfile;

function normalizeList(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return [val];
    }
  }
  return [];
}

export async function readEditableProfile(userId: number): Promise<EditableProfile | null> {
  const [row] = await sql`
    SELECT headline, bio, location FROM users WHERE id = ${userId}
  `;
  if (!row) return null;
  return {
    headline: normalizeList(row.headline),
    bio: row.bio ?? null,
    location: row.location ?? null,
    localizacao: row.location ?? null,
  };
}

export const lerPerfilEditavel = readEditableProfile;

export async function saveEditableProfile(
  userId: number,
  data: { headline?: string[]; bio?: string; location?: string; localizacao?: string }
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  try {
    const loc = data.location ?? data.localizacao;
    await sql`
      UPDATE users SET
        headline = ${data.headline ? sql.json(limitList(data.headline, 5)) : null},
        bio = ${limitOrNull(data.bio, LIMITS.bio)},
        location = ${limitOrNull(loc, LIMITS.location)}
      WHERE id = ${userId}
    `;
    return { ok: true };
  } catch {
    return { ok: false, error: "Database error while saving profile.", erro: "Erro ao salvar perfil." };
  }
}

export const salvarPerfilEditavel = saveEditableProfile;

export type EditorOnboarding = {
  name: string;
  avatarUrl?: string;
  photoUrl?: string;
  location: string;
  headline: string[];
  bio: string;
  softwareTools?: string[];
  softwares?: string[];
  editingStyles?: string[];
  styles?: string[];
  portfolioLink?: string;
  availability?: boolean[][];
  editingLevel?: string;
  pcSetup?: string;
  niches?: string[];
  niche?: string[];
  profileCompleted?: boolean;
  profileComplete?: boolean;
  // aliases
  nome?: string;
  fotoUrl?: string;
  localizacao?: string;
  estilos?: string[];
  portfolio_link?: string;
  disponibilidade?: boolean[][];
  nivelEdicao?: string;
  setupPc?: string;
  nicho?: string[];
  perfilCompleto?: boolean;
};

export type OnboardingEditor = EditorOnboarding;

export async function readEditorOnboarding(userId: number): Promise<EditorOnboarding | null> {
  const [row] = await sql`
    SELECT name, avatar_url, location, headline, bio, software_tools, editing_styles,
           portfolio_link, availability, editing_level, pc_setup, niches, profile_completed
    FROM users WHERE id = ${userId}
  `;
  if (!row) return null;
  return {
    name: row.name ?? "",
    avatarUrl: row.avatar_url ?? "",
    photoUrl: row.avatar_url ?? "",
    location: row.location ?? "",
    headline: normalizeList(row.headline),
    bio: row.bio ?? "",
    softwareTools: row.software_tools ?? [],
    softwares: row.software_tools ?? [],
    editingStyles: row.editing_styles ?? [],
    styles: row.editing_styles ?? [],
    portfolioLink: row.portfolio_link ?? "",
    availability: (row.availability ?? []) as boolean[][],
    editingLevel: row.editing_level ?? undefined,
    pcSetup: row.pc_setup ?? undefined,
    niches: row.niches ?? [],
    niche: row.niches ?? [],
    profileCompleted: row.profile_completed ?? false,
    profileComplete: row.profile_completed ?? false,
    // aliases
    nome: row.name ?? "",
    fotoUrl: row.avatar_url ?? "",
    localizacao: row.location ?? "",
    estilos: row.editing_styles ?? [],
    portfolio_link: row.portfolio_link ?? "",
    disponibilidade: (row.availability ?? []) as boolean[][],
    nivelEdicao: row.editing_level ?? undefined,
    setupPc: row.pc_setup ?? undefined,
    nicho: row.niches ?? [],
    perfilCompleto: row.profile_completed ?? false,
  };
}

export const lerOnboardingEditor = readEditorOnboarding;

export async function saveEditorOnboarding(
  userId: number,
  data: {
    name?: string;
    avatarUrl?: string;
    photoUrl?: string;
    location?: string;
    headline?: string[];
    bio?: string;
    softwareTools?: string[];
    softwares?: string[];
    editingStyles?: string[];
    styles?: string[];
    portfolioLink?: string;
    availability?: boolean[][];
    editingLevel?: string;
    editingExperienceLevel?: string;
    pcSetup?: string;
    niches?: string[];
    niche?: string[];
    availabilitySchedule?: boolean[][];
    // aliases
    nome?: string;
    fotoUrl?: string;
    localizacao?: string;
    estilos?: string[];
    portfolio_link?: string;
    disponibilidade?: boolean[][];
    nivelEdicao?: string;
    setupPc?: string;
    nicho?: string[];
  }
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rawName = data.name ?? data.nome ?? "";
  const name = limitStr(rawName, LIMITS.name);
  if (!name) return { ok: false, error: "Please enter your name.", erro: "Please enter your name." };

  const avatar = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
  if (!isValidPhoto(avatar)) {
    return { ok: false, error: "Photo must be a valid image under 1.5MB.", erro: "Invalid photo." };
  }

  const rawLocation = data.location ?? data.localizacao;
  const rawTools = data.softwareTools ?? data.softwares;
  const rawStyles = data.editingStyles ?? data.styles ?? data.estilos;
  const rawPortLink = data.portfolioLink ?? data.portfolio_link;
  const rawAvail = data.availability ?? data.disponibilidade ?? [];
  const rawEditLevel = data.editingLevel ?? data.nivelEdicao;
  const rawPcSetup = data.pcSetup ?? data.setupPc;
  const rawNiches = data.niches ?? data.niche ?? data.nicho;

  await sql`
    UPDATE users SET
      name = ${name},
      avatar_url = ${avatar?.trim() || null},
      location = ${limitOrNull(rawLocation, LIMITS.location)},
      headline = ${data.headline ? sql.json(limitList(data.headline, 5)) : null},
      bio = ${limitOrNull(data.bio, LIMITS.bio)},
      software_tools = ${limitList(rawTools, 10)},
      editing_styles = ${limitList(rawStyles, 5)},
      portfolio_link = ${limitOrNull(rawPortLink, LIMITS.link)},
      availability = ${sql.json(rawAvail)},
      editing_level = ${limitOrNull(rawEditLevel, LIMITS.tag)},
      pc_setup = ${limitOrNull(rawPcSetup, LIMITS.tag)},
      niches = ${limitList(rawNiches, 4)},
      profile_completed = true
    WHERE id = ${userId}
  `;
  return { ok: true };
}

export const salvarOnboardingEditor = saveEditorOnboarding;

export async function readEditorProfile(handleOrId: string | number): Promise<EditorProfile | null> {
  const whereClause =
    typeof handleOrId === "number"
      ? sql`id = ${handleOrId}`
      : sql`lower(handle) = lower(${handleOrId})`;

  const [l] = await sql`
    SELECT id, handle, name, avatar_url, location, headline, bio,
           software_tools, editing_styles, niches, editing_level, pc_setup,
           delivered_count, reputation, streak, rating, tier, created_at
    FROM users
    WHERE ${whereClause} AND role = 'editor'
  `;
  if (!l) return null;

  const portfolioRows = await sql`
    SELECT id, title, format, spokesperson, tint
    FROM portfolio
    WHERE user_id = ${l.id}
    ORDER BY created_at DESC
    LIMIT 12
  `;

  const historyRows = await sql`
    SELECT m.id, m.title, u.name AS spokesperson, m.created_at AS date, m.status
    FROM missions m
    JOIN users u ON u.id = m.spokesperson_id
    WHERE m.reserved_by_id = ${l.id} AND m.status IN ('approved','completed','finished','revision_requested','reedit')
    ORDER BY m.created_at DESC
    LIMIT 10
  `;

  const achievementRows = await sql`
    SELECT icon, name FROM achievements WHERE user_id = ${l.id} ORDER BY earned_at ASC
  `;

  const sinceDate = new Date(l.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const profile: EditorProfile = {
    handle: l.handle,
    name: l.name,
    headline: normalizeList(l.headline),
    location: l.location ?? "",
    since: sinceDate,
    bio: l.bio ?? "",
    photoUrl: l.avatar_url ?? undefined,
    avatarUrl: l.avatar_url ?? undefined,
    softwares: l.software_tools ?? [],
    softwareTools: l.software_tools ?? [],
    styles: l.editing_styles ?? [],
    editingStyles: l.editing_styles ?? [],
    niche: l.niches ?? [],
    niches: l.niches ?? [],
    editingLevel: l.editing_level ?? undefined,
    pcSetup: l.pc_setup ?? undefined,
    deliveries: l.delivered_count ?? 0,
    deliveredCount: l.delivered_count ?? 0,
    rating: l.rating === null ? null : Number(l.rating),
    tier: l.tier as Tier,
    reputation: l.reputation ?? 0,
    streak: l.streak ?? 0,
    portfolio: portfolioRows.map((p) => ({
      id: `p-${p.id}`,
      title: p.title,
      format: p.format,
      spokesperson: p.spokesperson,
      tint: p.tint ?? "linear-gradient(135deg,#3a3a42,#12121a)",
      titulo: p.title,
      formato: p.format,
      portaVoz: p.spokesperson,
    })),
    history: historyRows.map((h) => ({
      id: `h-${h.id}`,
      title: h.title,
      spokesperson: h.spokesperson,
      date: new Date(h.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      result: (h.status === "approved" || h.status === "completed" || h.status === "finished" ? "approved" : "revision_requested") as "approved" | "revision_requested",
      titulo: h.title,
      portaVoz: h.spokesperson,
      data: new Date(h.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      resultado: (h.status === "approved" || h.status === "completed" || h.status === "finished" ? "aprovada" : "reedicao") as "aprovada" | "reedicao",
    })),
    achievements: achievementRows.map((a) => ({ icon: a.icon, name: a.name, icone: a.icon, nome: a.name })),
    // aliases
    apelido: l.handle,
    nome: l.name,
    local: l.location ?? "",
    desde: sinceDate,
    fotoUrl: l.avatar_url ?? undefined,
    estilos: l.editing_styles ?? [],
    nicho: l.niches ?? [],
    nivelEdicao: l.editing_level ?? undefined,
    setupPc: l.pc_setup ?? undefined,
    entregues: l.delivered_count ?? 0,
    nota: l.rating === null ? null : Number(l.rating),
    nivel: l.tier as Tier,
    reputacao: l.reputation ?? 0,
    conquistas: achievementRows.map((a) => ({ icon: a.icon, name: a.name, icone: a.icon, nome: a.name })),
  };

  return profile;
}

export const lerPerfilEditor = readEditorProfile;

export async function getEditorLeaderboard(limit = 50): Promise<EditorRanking[]> {
  const rows = await sql`
    SELECT id, handle, tier, reputation, delivered_count, streak
    FROM users
    WHERE role = 'editor' AND profile_completed = true AND is_banned = false
    ORDER BY reputation DESC, delivered_count DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    tier: r.tier as Tier,
    level: r.tier as Tier,
    reputation: r.reputation,
    deliveredCount: r.delivered_count,
    streak: r.streak,
    apelido: r.handle,
    nivel: r.tier as Tier,
    reputacao: r.reputation,
    entregues: r.delivered_count,
  }));
}

export const editorLeaderboard = getEditorLeaderboard;
export const rankingEditores = getEditorLeaderboard;
