import { type Candidate, DEFAULT_TINT, type SocialLinks } from "@oficina/domain/candidates";
import { isValidPhoto, LIMITS, limitList, limitOrNull, limitStr } from "@oficina/domain/limits";
import type {
  EditorProfile,
  EditorRanking,
  HistoryItem,
  PortfolioItem,
  Tier,
} from "@oficina/domain/profile";
import { sql } from "./client.ts";

export type EditableProfile = {
  headline: string[];
  bio: string | null;
  location: string | null;
  hasPassword?: boolean;
  temSenha?: boolean;
  localizacao?: string | null;
};

export type SaveEditableProfileInput = {
  headline?: string[];
  bio?: string;
  location?: string;
  localizacao?: string;
};

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

export type SaveEditorOnboardingInput = {
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
};

export type CandidateOnboarding = {
  name: string;
  avatarUrl?: string;
  photoUrl?: string;
  role?: string;
  politicalOffice?: string;
  runningFor?: string;
  electionYear?: string;
  location?: string;
  causes?: string[];
  campaignFlags?: string[];
  communicationTone?: string;
  keywords?: string[];
  socialLinks?: SocialLinks;
  bio?: string;
  profileComplete?: boolean;
  profileCompleted?: boolean;
  watermark?: string;
  campaignTaxId?: string;
  voterId?: string;
  // compatibility aliases
  nome?: string;
  fotoUrl?: string;
  cargo?: string;
  disputaPor?: string;
  anoEleicao?: string;
  localizacao?: string;
  bandeiras?: string[];
  tomComunicacao?: string;
  palavrasChave?: string[];
  redes?: SocialLinks;
  perfilCompleto?: boolean;
  marcaDagua?: string;
  cnpjCampanha?: string;
  tituloEleitor?: string;
};

export type SaveCandidateOnboardingInput = {
  name?: string;
  photoUrl?: string;
  avatarUrl?: string;
  role?: string;
  politicalOffice?: string;
  runningFor?: string;
  electionYear?: string;
  location?: string;
  causes?: string[];
  policyFlags?: string[];
  campaignFlags?: string[];
  communicationTone?: string;
  keywords?: string[];
  socialLinks?: SocialLinks;
  bio?: string;
  watermark?: string;
  watermarkUrl?: string;
  campaignTaxId?: string;
  voterId?: string;
  voterRegistrationId?: string;
  // aliases
  nome?: string;
  fotoUrl?: string;
  cargo?: string;
  disputaPor?: string;
  anoEleicao?: string;
  localizacao?: string;
  bandeiras?: string[];
  tomComunicacao?: string;
  palavrasChave?: string[];
  redes?: SocialLinks;
  marcaDagua?: string;
  cnpjCampanha?: string;
  tituloEleitor?: string;
};

export interface ProfilesRepository {
  readEditableProfile(userId: number): Promise<EditableProfile | null>;
  saveEditableProfile(
    userId: number,
    data: SaveEditableProfileInput,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  readEditorOnboarding(userId: number): Promise<EditorOnboarding | null>;
  saveEditorOnboarding(
    userId: number,
    data: SaveEditorOnboardingInput,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  readEditorProfile(handleOrId: string | number): Promise<EditorProfile | null>;
  readEditorRanking(limit?: number): Promise<EditorRanking[]>;
  saveEditorSchedule(
    userId: number,
    grid: boolean[][],
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  readCandidateOnboarding(userId: number): Promise<CandidateOnboarding | null>;
  saveCandidateOnboarding(
    userId: number,
    data: SaveCandidateOnboardingInput,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  readOwnCandidate(userId: number): Promise<Candidate | null>;
  readPublicCandidate(slug: string): Promise<Candidate | null>;
  readCandidatesByHandles(handles: string[]): Promise<Map<string, Candidate>>;
}

export function normalizeList(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
  if (typeof val !== "string" || !val.trim()) return [];

  const text = val.trim();
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // fallback
    }
  }
  return [text];
}

export function normalizeGrid(val: unknown): boolean[][] {
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

export function normalizeSocialLinks(val: unknown): SocialLinks {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) {
    return val as SocialLinks;
  }
  if (typeof val === "string") {
    try {
      const parsed: unknown = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as SocialLinks;
      }
    } catch {
      return {};
    }
  }
  return {};
}

type CandidateRow = {
  id: number;
  apelido: string;
  nome: string;
  foto_url: string | null;
  cargo: string | null;
  disputa_por: string | null;
  ano_eleicao: string | null;
  localizacao: string | null;
  bandeiras: string[] | null;
  tom_comunicacao: string | null;
  palavras_chave: string[] | null;
  redes_sociais: SocialLinks | null;
  bio: string | null;
  criado_em: string;
  marca_dagua: string | null;
  cnpj_campanha: string | null;
  titulo_eleitor: string | null;
};

export function rowToCandidate(l: CandidateRow): Candidate {
  return {
    slug: l.apelido,
    name: l.nome,
    role: l.cargo ?? "Porta-voz",
    photoUrl: l.foto_url ?? undefined,
    politicalOffice: l.cargo ?? "",
    runningFor: l.disputa_por ?? undefined,
    electionYear: l.ano_eleicao ?? undefined,
    location: l.localizacao ?? "",
    proximity: 0,
    bio: l.bio ?? "",
    tint: DEFAULT_TINT,
    communicationTone: l.tom_comunicacao ?? undefined,
    campaignFlags: normalizeList(l.bandeiras),
    keywords: normalizeList(l.palavras_chave),
    socialLinks: normalizeSocialLinks(l.redes_sociais),
    since: new Date(l.criado_em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    watermark: l.marca_dagua ?? undefined,
    campaignTaxId: l.cnpj_campanha ?? undefined,
    voterId: l.titulo_eleitor ?? undefined,
    // aliases
    nome: l.nome,
    foto: l.foto_url ?? undefined,
    fotoUrl: l.foto_url ?? undefined,
    cargo: l.cargo ?? "",
    disputaPor: l.disputa_por ?? undefined,
    anoEleicao: l.ano_eleicao ?? undefined,
    local: l.localizacao ?? "",
    bandeiras: normalizeList(l.bandeiras),
    tomComunicacao: l.tom_comunicacao ?? undefined,
    palavrasChave: normalizeList(l.palavras_chave),
    redes: normalizeSocialLinks(l.redes_sociais),
    desde: new Date(l.criado_em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    marcaDagua: l.marca_dagua ?? undefined,
    cnpjCampanha: l.cnpj_campanha ?? undefined,
    tituloEleitor: l.titulo_eleitor ?? undefined,
  };
}

export const postgresProfiles: ProfilesRepository = {
  async readEditableProfile(userId) {
    const [row] = await sql`
      SELECT headline, bio, localizacao, senha_hash FROM users WHERE id = ${userId}
    `;
    if (!row) return null;
    return {
      headline: normalizeList(row.headline),
      bio: row.bio ?? null,
      location: row.localizacao ?? null,
      hasPassword: Boolean(row.senha_hash),
      temSenha: Boolean(row.senha_hash),
      localizacao: row.localizacao ?? null,
    };
  },

  async saveEditableProfile(userId, data) {
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
  },

  async readEditorOnboarding(userId) {
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
        profileCompleted: Boolean(row.perfil_completo),
        profileComplete: Boolean(row.perfil_completo),
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
        perfilCompleto: Boolean(row.perfil_completo),
      };
    } catch {
      return null;
    }
  },

  async saveEditorOnboarding(userId, data) {
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
  },

  async readEditorProfile(handleOrId) {
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
            ORDER BY conquistada_em DESC`,
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
          date: new Date(h.criada_em).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
          result: res,
          titulo: h.titulo,
          portaVoz: h.porta_voz,
          data: new Date(h.criada_em).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
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
        level: (account.nivel as Tier) ?? "Aprendiz",
        tier: (account.nivel as Tier) ?? "Aprendiz",
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
  },

  async readEditorRanking(limit = 10) {
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
      level: (r.nivel as Tier) ?? "Aprendiz",
      deliveredCount: Number(r.entregues ?? 0),
      reputation: Number(r.reputacao ?? 0),
      streak: Number(r.streak ?? 0),
      // aliases
      apelido: r.apelido,
      nivel: (r.nivel as Tier) ?? "Aprendiz",
      entregues: Number(r.entregues ?? 0),
      reputacao: Number(r.reputacao ?? 0),
    }));
  },

  async saveEditorSchedule(userId, grid) {
    const isValid =
      Array.isArray(grid) &&
      grid.length === 3 &&
      grid.every((l: unknown) => Array.isArray(l) && l.length === 7);

    if (!isValid) {
      return {
        ok: false,
        error: "Grade de disponibilidade inválida.",
        erro: "Grade de disponibilidade inválida.",
      };
    }

    await sql`
      UPDATE users SET disponibilidade = ${sql.json(
        grid.map((l: unknown[]) => l.map(Boolean)),
      )} WHERE id = ${userId}
    `;
    return { ok: true };
  },

  async readCandidateOnboarding(userId) {
    const [l] = await sql`
      SELECT nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
             bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
             perfil_completo, marca_dagua, cnpj_campanha, titulo_eleitor
      FROM users WHERE id = ${userId}
    `;
    if (!l) return null;
    return {
      name: l.nome ?? "",
      avatarUrl: l.foto_url ?? "",
      photoUrl: l.foto_url ?? "",
      role: l.cargo ?? "",
      politicalOffice: l.cargo ?? "",
      runningFor: l.disputa_por ?? "",
      electionYear: l.ano_eleicao ?? "2026",
      location: l.localizacao ?? "",
      causes: normalizeList(l.bandeiras),
      campaignFlags: normalizeList(l.bandeiras),
      communicationTone: l.tom_comunicacao ?? "",
      keywords: normalizeList(l.palavras_chave),
      socialLinks: normalizeSocialLinks(l.redes_sociais),
      bio: l.bio ?? "",
      profileComplete: Boolean(l.perfil_completo),
      profileCompleted: Boolean(l.perfil_completo),
      watermark: l.marca_dagua ?? undefined,
      campaignTaxId: l.cnpj_campanha ?? undefined,
      voterId: l.titulo_eleitor ?? undefined,
      // aliases
      nome: l.nome ?? "",
      fotoUrl: l.foto_url ?? "",
      cargo: l.cargo ?? "",
      disputaPor: l.disputa_por ?? "",
      anoEleicao: l.ano_eleicao ?? "2026",
      localizacao: l.localizacao ?? "",
      bandeiras: normalizeList(l.bandeiras),
      tomComunicacao: l.tom_comunicacao ?? "",
      palavrasChave: normalizeList(l.palavras_chave),
      redes: normalizeSocialLinks(l.redes_sociais),
      perfilCompleto: Boolean(l.perfil_completo),
      marcaDagua: l.marca_dagua ?? undefined,
      cnpjCampanha: l.cnpj_campanha ?? undefined,
      tituloEleitor: l.titulo_eleitor ?? undefined,
    };
  },

  async saveCandidateOnboarding(userId, data) {
    const rawName = data.name ?? data.nome ?? "";
    const name = limitStr(rawName, LIMITS.name);
    if (!name) return { ok: false, error: "Digite seu nome.", erro: "Digite seu nome." };

    const photo = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
    if (!isValidPhoto(photo)) {
      return {
        ok: false,
        error: "A foto precisa ser imagem e ter menos de 1,5 MB.",
        erro: "A foto precisa ser imagem e ter menos de 1,5 MB.",
      };
    }

    const office = data.politicalOffice ?? data.role ?? data.cargo;
    if (!office?.trim()) return { ok: false, error: "Escolha o cargo.", erro: "Escolha o cargo." };

    const loc = data.location ?? data.localizacao;
    if (!loc?.trim())
      return { ok: false, error: "Preencha a região.", erro: "Preencha a região." };

    const running = data.runningFor ?? data.disputaPor;
    const year = data.electionYear ?? data.anoEleicao ?? "2026";
    const flags = data.campaignFlags ?? data.causes ?? data.bandeiras;
    const tone = data.communicationTone ?? data.tomComunicacao;
    const kw = data.keywords ?? data.palavrasChave;
    const links = data.socialLinks ?? data.redes ?? {};
    const bio = data.bio;
    const watermark = data.watermark ?? data.marcaDagua;
    const campaignTaxId = data.campaignTaxId ?? data.cnpjCampanha;
    const voterId = data.voterId ?? data.tituloEleitor;

    await sql`
      UPDATE users SET
        nome = ${name},
        foto_url = ${photo?.trim() || null},
        cargo = ${limitOrNull(office, LIMITS.tag)},
        disputa_por = ${limitOrNull(running, LIMITS.tag)},
        ano_eleicao = ${limitOrNull(year, 4)},
        localizacao = ${limitOrNull(loc, LIMITS.location)},
        bandeiras = ${limitList(flags, 12)},
        tom_comunicacao = ${limitOrNull(tone, LIMITS.tag)},
        palavras_chave = ${limitList(kw, 8)},
        redes_sociais = ${sql.json(links)},
        bio = ${limitOrNull(bio, LIMITS.bio)},
        marca_dagua = ${limitOrNull(watermark, LIMITS.briefField)},
        cnpj_campanha = ${limitOrNull(campaignTaxId, LIMITS.briefField)},
        titulo_eleitor = ${limitOrNull(voterId, LIMITS.briefField)},
        perfil_completo = true
      WHERE id = ${userId}
    `;

    return { ok: true };
  },

  async readOwnCandidate(userId) {
    const [l] = await sql`
      SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
             localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
             criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
      FROM users
      WHERE id = ${userId}
    `;
    if (!l) return null;
    return rowToCandidate(l as CandidateRow);
  },

  async readPublicCandidate(slug) {
    const [l] = await sql`
      SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
             localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
             criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
      FROM users
      WHERE lower(apelido) = lower(${slug}) AND papel IN ('voz', 'spokesperson') AND perfil_completo = true AND banido = false
    `;
    if (!l) return null;
    return rowToCandidate(l as CandidateRow);
  },

  async readCandidatesByHandles(handles) {
    if (handles.length === 0) return new Map();
    const rows = await sql`
      SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
             localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
             criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
      FROM users
      WHERE apelido = ANY(${handles})
    `;
    const map = new Map<string, Candidate>();
    for (const r of rows) {
      map.set(r.apelido, rowToCandidate(r as CandidateRow));
    }
    return map;
  },
};
