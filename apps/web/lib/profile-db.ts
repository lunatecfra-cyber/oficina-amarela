import { sql } from "@/lib/db";
import { isValidPhoto, LIMITS, limitList, limitOrNull, limitStr } from "@/lib/limits";
import type { EditorProfile, EditorRanking, HistoryItem, PortfolioItem } from "@/lib/profile";

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
  if (typeof val !== "string" || !val.trim()) return [];

  const text = val.trim();
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // fallback to plain string below
    }
  }
  return [text];
}

function normalizeGrid(val: unknown): boolean[][] {
  let g = val;
  if (typeof g === "string") {
    try {
      g = JSON.parse(g);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(g)) return [];
  return g.map((row) => (Array.isArray(row) ? row.map(Boolean) : []));
}

export async function readEditableProfile(userId: number): Promise<EditableProfile | null> {
  const [row] = await sql`
    SELECT headline, bio, localizacao FROM users WHERE id = ${userId}
  `;
  if (!row) return null;
  return {
    headline: normalizeList(row.headline),
    bio: row.bio ?? null,
    location: row.localizacao ?? null,
    localizacao: row.localizacao ?? null,
  };
}

export const lerPerfilEditavel = readEditableProfile;

export async function saveEditableProfile(
  userId: number,
  data: { headline?: string[]; bio?: string; location?: string; localizacao?: string },
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  try {
    const loc = data.location ?? data.localizacao;
    await sql`
      UPDATE users SET
        headline = ${data.headline ? sql.json(limitList(data.headline, 5)) : null},
        bio = ${limitOrNull(data.bio, LIMITS.bio)},
        localizacao = ${limitOrNull(loc, LIMITS.location)}
      WHERE id = ${userId}
    `;
    return { ok: true };
  } catch (err) {
    console.error("[profile] error saving editable profile:", err);
    return {
      ok: false,
      error: "Erro ao salvar perfil. Tente novamente.",
      erro: "Erro ao salvar perfil. Tente novamente.",
    };
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
  try {
    const [row] = await sql`
      SELECT nome, foto_url, localizacao, headline, bio, softwares, estilos, nivel_edicao,
             setup_pc, link_portfolio, nicho, disponibilidade, perfil_completo
      FROM users WHERE id = ${userId}
    `;
    if (!row) return null;
    return {
      name: row.nome ?? "",
      avatarUrl: row.foto_url ?? "",
      photoUrl: row.foto_url ?? "",
      location: row.localizacao ?? "",
      headline: normalizeList(row.headline),
      bio: row.bio ?? "",
      softwareTools: normalizeList(row.softwares),
      softwares: normalizeList(row.softwares),
      editingStyles: normalizeList(row.estilos),
      styles: normalizeList(row.estilos),
      portfolioLink: row.link_portfolio ?? "",
      availability: normalizeGrid(row.disponibilidade),
      editingLevel: row.nivel_edicao ?? undefined,
      pcSetup: row.setup_pc ?? undefined,
      niches: normalizeList(row.nicho),
      niche: normalizeList(row.nicho),
      profileCompleted: row.perfil_completo ?? false,
      profileComplete: row.perfil_completo ?? false,
      // aliases
      nome: row.nome ?? "",
      fotoUrl: row.foto_url ?? "",
      localizacao: row.localizacao ?? "",
      estilos: normalizeList(row.estilos),
      portfolio_link: row.link_portfolio ?? "",
      disponibilidade: normalizeGrid(row.disponibilidade),
      nivelEdicao: row.nivel_edicao ?? undefined,
      setupPc: row.setup_pc ?? undefined,
      nicho: normalizeList(row.nicho),
      perfilCompleto: row.perfil_completo ?? false,
    };
  } catch {
    return null;
  }
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
    availabilitySchedule?: boolean[][];
    editingLevel?: string;
    editingExperienceLevel?: string;
    pcSetup?: string;
    niches?: string[];
    niche?: string[];
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
  },
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rawName = data.name ?? data.nome ?? "";
  const name = limitStr(rawName, LIMITS.name);
  if (!name) return { ok: false, error: "Digite seu nome.", erro: "Digite seu nome." };

  const avatar = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
  if (!isValidPhoto(avatar)) {
    return {
      ok: false,
      error: "A foto precisa ser imagem e ter menos de 1,5 MB.",
      erro: "A foto precisa ser imagem e ter menos de 1,5 MB.",
    };
  }

  const rawLocation = data.location ?? data.localizacao;
  const rawTools = data.softwareTools ?? data.softwares;
  const rawStyles = data.editingStyles ?? data.styles ?? data.estilos;
  const rawPortLink = data.portfolioLink ?? data.portfolio_link;
  const rawAvail = data.availability ?? data.disponibilidade;
  const rawEditLevel = data.editingLevel ?? data.nivelEdicao;
  const rawPcSetup = data.pcSetup ?? data.setupPc;
  const rawNiches = data.niches ?? data.niche ?? data.nicho;

  const newGrid = rawAvail ? sql.json(rawAvail) : null;

  await sql`
    UPDATE users SET
      nome = ${name},
      foto_url = ${avatar?.trim() || null},
      localizacao = ${limitOrNull(rawLocation, LIMITS.location)},
      headline = ${data.headline ? sql.json(limitList(data.headline, 5)) : null},
      bio = ${limitOrNull(data.bio, LIMITS.bio)},
      softwares = ${limitList(rawTools, 12)},
      estilos = ${limitList(rawStyles, 3)},
      nivel_edicao = ${limitOrNull(rawEditLevel, LIMITS.tag)},
      setup_pc = ${limitOrNull(rawPcSetup, LIMITS.tag)},
      link_portfolio = ${limitOrNull(rawPortLink, LIMITS.link)},
      nicho = ${limitList(rawNiches, 4)},
      disponibilidade = COALESCE(${newGrid}, disponibilidade),
      perfil_completo = true
    WHERE id = ${userId}
  `;
  return { ok: true };
}

export const salvarOnboardingEditor = saveEditorOnboarding;

export async function readEditorProfile(
  handleOrId: string | number,
): Promise<EditorProfile | null> {
  try {
    const whereClause =
      typeof handleOrId === "number"
        ? sql`id = ${handleOrId}`
        : sql`lower(apelido) = lower(${handleOrId})`;

    const [account] = await sql`
      SELECT id, apelido, nome, headline, bio, localizacao, criado_em,
             entregues, reputacao, streak, nota, nivel,
             foto_url, softwares, estilos, nicho, nivel_edicao, setup_pc
      FROM users
      WHERE ${whereClause}
    `;
    if (!account) return null;

    const [portfolioItems, achievementItems, deliveryItems] = await Promise.all([
      sql`SELECT id, titulo, formato, porta_voz, tint, link_video
          FROM portfolio WHERE user_id = ${account.id} ORDER BY criado_em DESC`,
      sql`SELECT nome, icone FROM conquistas WHERE user_id = ${account.id}
          ORDER BY conquistado_em DESC`,
      sql`SELECT p.id, p.titulo, p.status, p.criada_em, u.nome AS porta_voz
          FROM pautas p
          JOIN users u ON u.id = p.porta_voz_id
          WHERE p.reservada_por_id = ${account.id}
            AND p.status IN ('aprovada','finalizada','reedicao')
          ORDER BY p.criada_em DESC`,
    ]);

    const portfolio: PortfolioItem[] = (portfolioItems as any[]).map((i) => ({
      id: `pf-${i.id}`,
      title: i.titulo,
      format: i.formato,
      spokesperson: i.porta_voz,
      tint: i.tint ?? "linear-gradient(135deg,#3a3a42,#12121a)",
      titulo: i.titulo,
      formato: i.formato,
      portaVoz: i.porta_voz,
    }));

    const history: HistoryItem[] = (deliveryItems as any[]).map((h) => {
      const res = h.status === "reedicao" ? "revision_requested" : "approved";
      return {
        id: `h-${h.id}`,
        title: h.titulo,
        spokesperson: h.porta_voz,
        date: new Date(h.criada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        result: res,
        titulo: h.titulo,
        portaVoz: h.porta_voz,
        data: new Date(h.criada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        resultado: h.status === "reedicao" ? "reedicao" : "aprovada",
      };
    });

    const achievements = (achievementItems as any[]).map((m) => ({
      icon: m.icone ?? "🏅",
      name: m.nome,
      icone: m.icone ?? "🏅",
      nome: m.nome,
    }));

    return {
      handle: account.apelido,
      name: account.nome,
      headline: normalizeList(account.headline),
      location: account.localizacao ?? "",
      since: new Date(account.criado_em).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      bio: account.bio ?? "",
      photoUrl: account.foto_url ?? undefined,
      softwares: normalizeList(account.softwares),
      styles: normalizeList(account.estilos),
      niche: normalizeList(account.nicho),
      editingLevel: account.nivel_edicao ?? undefined,
      pcSetup: account.setup_pc ?? undefined,
      deliveries: Number(account.entregues ?? 0),
      deliveredCount: Number(account.entregues ?? 0),
      reputation: Number(account.reputacao ?? 0),
      streak: Number(account.streak ?? 0),
      rating: account.nota !== null ? Number(account.nota) : null,
      level: account.nivel ?? "Aspirante",
      portfolio,
      history,
      achievements,
      // aliases
      apelido: account.apelido,
      nome: account.nome,
      local: account.localizacao ?? "",
      desde: new Date(account.criado_em).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      fotoUrl: account.foto_url ?? undefined,
      estilos: normalizeList(account.estilos),
      nivelEdicao: account.nivel_edicao ?? undefined,
      setupPc: account.setup_pc ?? undefined,
      entregues: Number(account.entregues ?? 0),
      reputacao: Number(account.reputacao ?? 0),
      nota: account.nota !== null ? Number(account.nota) : null,
      conquistas: achievements,
      historico: history,
    };
  } catch (err) {
    console.error("[profile] error reading editor profile:", err);
    return null;
  }
}

export const lerPerfilEditor = readEditorProfile;

export async function readEditorRanking(limit = 10): Promise<EditorRanking[]> {
  const rows = await sql`
    SELECT id, apelido, nome, foto_url, entregues, reputacao, streak, nota, nivel
    FROM users
    WHERE papel = 'editor' AND perfil_completo = true
    ORDER BY entregues DESC, reputacao DESC, criado_em ASC
    LIMIT ${limit}
  `;
  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    handle: r.apelido,
    level: r.nivel ?? "Aspirante",
    deliveredCount: Number(r.entregues ?? 0),
    reputation: Number(r.reputacao ?? 0),
    streak: Number(r.streak ?? 0),
    // aliases
    apelido: r.apelido,
    nivel: r.nivel ?? "Aspirante",
    entregues: Number(r.entregues ?? 0),
    reputacao: Number(r.reputacao ?? 0),
  }));
}

export const rankingEditores = readEditorRanking;
