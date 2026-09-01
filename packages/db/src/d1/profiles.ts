import { validateCampaignIdentity } from "@oficina/domain/campaign-identity";
import type { Candidate } from "@oficina/domain/candidates";
import { isValidPhoto, LIMITS, limitList, limitOrNull, limitStr } from "@oficina/domain/limits";
import type { HistoryItem, PortfolioItem, Tier } from "@oficina/domain/profile";
import { normalizeWhatsapp } from "@oficina/domain/whatsapp";
import {
  normalizeGrid,
  normalizeList,
  normalizeSocialLinks,
  type ProfilesRepository,
  rowToCandidate,
} from "../profiles.ts";
import type { D1DatabaseLike } from "./types.ts";

export function createD1Profiles(db: D1DatabaseLike): ProfilesRepository {
  return {
    async readEditableProfile(userId) {
      const row = await db
        .prepare("SELECT headline, bio, location, whatsapp, password_hash FROM users WHERE id = ?")
        .bind(userId)
        .first<{
          headline: string | null;
          bio: string | null;
          location: string | null;
          whatsapp: string | null;
          password_hash: string | null;
        }>();
      if (!row) return null;
      return {
        headline: normalizeList(row.headline),
        bio: row.bio ?? null,
        location: row.location ?? null,
        whatsapp: row.whatsapp ?? null,
        hasPassword: Boolean(row.password_hash),
        temSenha: Boolean(row.password_hash),
        localizacao: row.location ?? null,
      };
    },

    async saveEditableProfile(userId, data) {
      try {
        const loc = data.location ?? data.localizacao;
        const headlineJson = data.headline ? JSON.stringify(limitList(data.headline, 5)) : null;
        await db
          .prepare(
            "UPDATE users SET headline = ?, bio = ?, location = ?, whatsapp = ? WHERE id = ?",
          )
          .bind(
            headlineJson,
            limitOrNull(data.bio, LIMITS.bio),
            limitOrNull(loc, LIMITS.location),
            normalizeWhatsapp(data.whatsapp),
            userId,
          )
          .run();
        return { ok: true };
      } catch (err) {
        console.error("[profile-d1] error saving editable profile:", err);
        return {
          ok: false,
          error: "Erro ao salvar perfil. Tente novamente.",
          erro: "Erro ao salvar perfil. Tente novamente.",
        };
      }
    },

    async readEditorOnboarding(userId) {
      try {
        const row = await db
          .prepare(
            `SELECT name, avatar_url, location, headline, bio, software_tools, editing_styles, editing_level,
                    pc_setup, portfolio_link, whatsapp, niches, availability, profile_completed
             FROM users WHERE id = ?`,
          )
          .bind(userId)
          .first<{
            name: string | null;
            avatar_url: string | null;
            location: string | null;
            headline: string | null;
            bio: string | null;
            software_tools: string | null;
            editing_styles: string | null;
            editing_level: string | null;
            pc_setup: string | null;
            portfolio_link: string | null;
            whatsapp: string | null;
            niches: string | null;
            availability: string | null;
            profile_completed: number | null;
          }>();
        if (!row) return null;
        return {
          name: row.name ?? "",
          avatarUrl: row.avatar_url ?? "",
          photoUrl: row.avatar_url ?? "",
          location: row.location ?? "",
          headline: normalizeList(row.headline),
          bio: row.bio ?? "",
          softwareTools: normalizeList(row.software_tools),
          softwares: normalizeList(row.software_tools),
          editingStyles: normalizeList(row.editing_styles),
          styles: normalizeList(row.editing_styles),
          portfolioLink: row.portfolio_link ?? "",
          whatsapp: row.whatsapp ?? undefined,
          availability: normalizeGrid(row.availability),
          editingLevel: row.editing_level ?? undefined,
          pcSetup: row.pc_setup ?? undefined,
          niches: normalizeList(row.niches),
          niche: normalizeList(row.niches),
          profileCompleted: Boolean(row.profile_completed),
          profileComplete: Boolean(row.profile_completed),
          // aliases
          nome: row.name ?? "",
          fotoUrl: row.avatar_url ?? "",
          localizacao: row.location ?? "",
          estilos: normalizeList(row.editing_styles),
          portfolio_link: row.portfolio_link ?? "",
          disponibilidade: normalizeGrid(row.availability),
          nivelEdicao: row.editing_level ?? undefined,
          setupPc: row.pc_setup ?? undefined,
          nicho: normalizeList(row.niches),
          perfilCompleto: Boolean(row.profile_completed),
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

      const headlineJson = data.headline ? JSON.stringify(limitList(data.headline, 5)) : null;
      const toolsJson = rawTools ? JSON.stringify(limitList(rawTools, 12)) : null;
      const stylesJson = rawStyles ? JSON.stringify(limitList(rawStyles, 3)) : null;
      const nichesJson = rawNiches ? JSON.stringify(limitList(rawNiches, 4)) : null;
      const newGridJson = rawAvail ? JSON.stringify(rawAvail) : null;

      await db
        .prepare(
          `UPDATE users SET
             name = ?,
             avatar_url = ?,
             location = ?,
             headline = ?,
             bio = ?,
             software_tools = ?,
             editing_styles = ?,
             editing_level = ?,
             pc_setup = ?,
             portfolio_link = ?,
             whatsapp = ?,
             niches = ?,
             availability = COALESCE(?, availability),
             profile_completed = 1
           WHERE id = ?`,
        )
        .bind(
          name,
          avatar?.trim() || null,
          limitOrNull(rawLocation, LIMITS.location),
          headlineJson,
          limitOrNull(data.bio, LIMITS.bio),
          toolsJson,
          stylesJson,
          limitOrNull(rawEditLevel, LIMITS.tag),
          limitOrNull(rawPcSetup, LIMITS.tag),
          limitOrNull(rawPortLink, LIMITS.link),
          normalizeWhatsapp(data.whatsapp),
          nichesJson,
          newGridJson,
          userId,
        )
        .run();

      return { ok: true };
    },

    async readEditorProfile(handleOrId) {
      try {
        const isNumeric = typeof handleOrId === "number";
        const accountQuery = isNumeric
          ? "SELECT * FROM users WHERE id = ?"
          : "SELECT * FROM users WHERE lower(handle) = lower(?)";

        const account = await db
          .prepare(accountQuery)
          .bind(isNumeric ? handleOrId : String(handleOrId).trim())
          .first<{
            id: number;
            handle: string;
            name: string;
            headline: string | null;
            bio: string | null;
            location: string | null;
            created_at: string;
            delivered_count: number | null;
            reputation: number | null;
            streak: number | null;
            rating: number | null;
            tier: string | null;
            avatar_url: string | null;
            software_tools: string | null;
            editing_styles: string | null;
            niches: string | null;
            editing_level: string | null;
            pc_setup: string | null;
          }>();
        if (!account) return null;

        const [portfolioRes, achievementRes, deliveryRes] = await Promise.all([
          db
            .prepare(
              "SELECT id, title, format, spokesperson, tint, video_link FROM portfolio WHERE user_id = ? ORDER BY created_at DESC",
            )
            .bind(account.id)
            .all<{
              id: number;
              title: string;
              format: "short" | "longo";
              spokesperson: string;
              tint: string | null;
              video_link: string | null;
            }>(),
          db
            .prepare(
              "SELECT name, icon FROM achievements WHERE user_id = ? ORDER BY earned_at DESC",
            )
            .bind(account.id)
            .all<{ name: string; icon: string | null }>(),
          db
            .prepare(
              `SELECT p.id, p.title, p.status, p.created_at, u.name AS spokesperson
               FROM missions p
               JOIN users u ON u.id = p.spokesperson_id
               WHERE p.reserved_by_id = ?
                 AND p.status IN ('aprovada', 'finalizada', 'reedicao')
               ORDER BY p.created_at DESC`,
            )
            .bind(account.id)
            .all<{
              id: number;
              title: string;
              status: string;
              created_at: string;
              spokesperson: string;
            }>(),
        ]);

        const portfolio: PortfolioItem[] = portfolioRes.results.map((i) => ({
          id: `pf-${i.id}`,
          title: i.title,
          format: i.format,
          spokesperson: i.spokesperson,
          tint: i.tint ?? "linear-gradient(135deg,#3a3a42,#12121a)",
          titulo: i.title,
          formato: i.format,
          portaVoz: i.spokesperson,
        }));

        const history: HistoryItem[] = deliveryRes.results.map((h) => {
          const res = h.status === "reedicao" ? "revision_requested" : "approved";
          return {
            id: `h-${h.id}`,
            title: h.title,
            spokesperson: h.spokesperson,
            date: new Date(h.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            }),
            result: res,
            titulo: h.title,
            portaVoz: h.spokesperson,
            data: new Date(h.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            }),
            resultado: h.status === "reedicao" ? "reedicao" : "aprovada",
          };
        });

        const achievements = achievementRes.results.map((m) => ({
          icon: m.icon ?? "🏅",
          name: m.name,
          icone: m.icon ?? "🏅",
          nome: m.name,
        }));

        return {
          handle: account.handle,
          name: account.name,
          headline: normalizeList(account.headline),
          location: account.location ?? "",
          since: new Date(account.created_at).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          }),
          bio: account.bio ?? "",
          photoUrl: account.avatar_url ?? undefined,
          softwares: normalizeList(account.software_tools),
          styles: normalizeList(account.editing_styles),
          niche: normalizeList(account.niches),
          editingLevel: account.editing_level ?? undefined,
          pcSetup: account.pc_setup ?? undefined,
          deliveries: Number(account.delivered_count ?? 0),
          deliveredCount: Number(account.delivered_count ?? 0),
          reputation: Number(account.reputation ?? 0),
          streak: Number(account.streak ?? 0),
          rating: account.rating !== null ? Number(account.rating) : null,
          level: (account.tier as Tier) ?? "Aprendiz",
          tier: (account.tier as Tier) ?? "Aprendiz",
          portfolio,
          history,
          achievements,
          // aliases
          apelido: account.handle,
          nome: account.name,
          local: account.location ?? "",
          desde: new Date(account.created_at).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          }),
          fotoUrl: account.avatar_url ?? undefined,
          estilos: normalizeList(account.editing_styles),
          nivelEdicao: account.editing_level ?? undefined,
          setupPc: account.pc_setup ?? undefined,
          entregues: Number(account.delivered_count ?? 0),
          reputacao: Number(account.reputation ?? 0),
          nota: account.rating !== null ? Number(account.rating) : null,
          conquistas: achievements,
          historico: history,
        };
      } catch (err) {
        console.error("[profile-d1] error reading editor profile:", err);
        return null;
      }
    },

    async readEditorRanking(limit = 10) {
      const { results } = await db
        .prepare(
          `SELECT id, handle, name, avatar_url, delivered_count, reputation, streak, rating, tier
           FROM users
           WHERE role = 'editor' AND profile_completed = 1
           ORDER BY delivered_count DESC, reputation DESC, created_at ASC
           LIMIT ?`,
        )
        .bind(limit)
        .all<{
          id: number;
          handle: string;
          name: string;
          avatar_url: string | null;
          delivered_count: number | null;
          reputation: number | null;
          streak: number | null;
          rating: number | null;
          tier: string | null;
        }>();
      return results.map((r) => ({
        id: Number(r.id),
        handle: r.handle,
        level: (r.tier as Tier) ?? "Aprendiz",
        deliveredCount: Number(r.delivered_count ?? 0),
        reputation: Number(r.reputation ?? 0),
        streak: Number(r.streak ?? 0),
        // aliases
        apelido: r.handle,
        nivel: (r.tier as Tier) ?? "Aprendiz",
        entregues: Number(r.delivered_count ?? 0),
        reputacao: Number(r.reputation ?? 0),
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

      await db
        .prepare("UPDATE users SET availability = ? WHERE id = ?")
        .bind(JSON.stringify(grid.map((l: unknown[]) => l.map(Boolean))), userId)
        .run();
      return { ok: true };
    },

    async readCandidateOnboarding(userId) {
      const l = await db
        .prepare(
          `SELECT name, avatar_url, political_office, running_for, election_year, location,
                  campaign_flags, communication_tone, keywords, social_links, bio,
                  profile_completed, watermark, campaign_tax_id, candidate_number, voter_id, whatsapp
           FROM users WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          name: string | null;
          avatar_url: string | null;
          political_office: string | null;
          running_for: string | null;
          election_year: string | null;
          location: string | null;
          campaign_flags: string | null;
          communication_tone: string | null;
          keywords: string | null;
          social_links: string | null;
          bio: string | null;
          profile_completed: number | null;
          watermark: string | null;
          campaign_tax_id: string | null;
          candidate_number: string | null;
          voter_id: string | null;
          whatsapp: string | null;
        }>();
      if (!l) return null;
      return {
        name: l.name ?? "",
        avatarUrl: l.avatar_url ?? "",
        photoUrl: l.avatar_url ?? "",
        role: l.political_office ?? "",
        politicalOffice: l.political_office ?? "",
        runningFor: l.running_for ?? "",
        electionYear: l.election_year ?? "2026",
        location: l.location ?? "",
        causes: normalizeList(l.campaign_flags),
        campaignFlags: normalizeList(l.campaign_flags),
        communicationTone: l.communication_tone ?? "",
        keywords: normalizeList(l.keywords),
        socialLinks: normalizeSocialLinks(l.social_links),
        bio: l.bio ?? "",
        profileComplete: Boolean(l.profile_completed),
        profileCompleted: Boolean(l.profile_completed),
        watermark: l.watermark ?? undefined,
        campaignTaxId: l.campaign_tax_id ?? undefined,
        candidateNumber: l.candidate_number ?? undefined,
        whatsapp: l.whatsapp ?? undefined,
        voterId: l.voter_id ?? undefined,
        // aliases
        nome: l.name ?? "",
        fotoUrl: l.avatar_url ?? "",
        cargo: l.political_office ?? "",
        disputaPor: l.running_for ?? "",
        anoEleicao: l.election_year ?? "2026",
        localizacao: l.location ?? "",
        bandeiras: normalizeList(l.campaign_flags),
        tomComunicacao: l.communication_tone ?? "",
        palavrasChave: normalizeList(l.keywords),
        redes: normalizeSocialLinks(l.social_links),
        perfilCompleto: Boolean(l.profile_completed),
        marcaDagua: l.watermark ?? undefined,
        cnpjCampanha: l.campaign_tax_id ?? undefined,
        numeroEleitoral: l.candidate_number ?? undefined,
        tituloEleitor: l.voter_id ?? undefined,
      };
    },

    async saveCandidateOnboarding(userId, data) {
      const identity = validateCampaignIdentity({
        officialName: data.name ?? data.nome ?? "",
        candidateNumber: data.candidateNumber ?? data.numeroEleitoral ?? "",
        campaignTaxId: data.campaignTaxId ?? data.cnpjCampanha ?? "",
      });
      if (!identity.ok) return { ok: false, error: identity.error, erro: identity.error };
      const name = limitStr(identity.value.officialName, LIMITS.name);

      const photo = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
      if (!isValidPhoto(photo)) {
        return {
          ok: false,
          error: "A foto precisa ser imagem e ter menos de 1,5 MB.",
          erro: "A foto precisa ser imagem e ter menos de 1,5 MB.",
        };
      }

      const office = data.politicalOffice ?? data.role ?? data.cargo;
      if (!office?.trim())
        return { ok: false, error: "Escolha o cargo.", erro: "Escolha o cargo." };

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
      const campaignTaxId = identity.value.campaignTaxId;
      const candidateNumber = identity.value.candidateNumber;
      const voterId = data.voterId ?? data.tituloEleitor;

      const flagsJson = flags ? JSON.stringify(limitList(flags, 12)) : null;
      const kwJson = kw ? JSON.stringify(limitList(kw, 8)) : null;
      const linksJson = JSON.stringify(links);

      await db
        .prepare(
          `UPDATE users SET
             name = ?,
             avatar_url = ?,
             political_office = ?,
             running_for = ?,
             election_year = ?,
             location = ?,
             campaign_flags = ?,
             communication_tone = ?,
             keywords = ?,
             social_links = ?,
             bio = ?,
             watermark = ?,
             campaign_tax_id = ?,
             candidate_number = ?,
             whatsapp = ?,
             voter_id = ?,
             profile_completed = 1
           WHERE id = ?`,
        )
        .bind(
          name,
          photo?.trim() || null,
          limitOrNull(office, LIMITS.tag),
          limitOrNull(running, LIMITS.tag),
          limitOrNull(year, 4),
          limitOrNull(loc, LIMITS.location),
          flagsJson,
          limitOrNull(tone, LIMITS.tag),
          kwJson,
          linksJson,
          limitOrNull(bio, LIMITS.bio),
          limitOrNull(watermark, LIMITS.briefField),
          limitOrNull(campaignTaxId, LIMITS.briefField),
          candidateNumber,
          normalizeWhatsapp(data.whatsapp),
          limitOrNull(voterId, LIMITS.briefField),
          userId,
        )
        .run();

      return { ok: true };
    },

    async readOwnCandidate(userId) {
      const l = await db
        .prepare(
          `SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
                  location, campaign_flags, communication_tone, keywords, social_links, bio,
                  created_at, watermark, campaign_tax_id, candidate_number, voter_id
           FROM users
           WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          id: number;
          handle: string;
          name: string;
          avatar_url: string | null;
          political_office: string | null;
          running_for: string | null;
          election_year: string | null;
          location: string | null;
          campaign_flags: string | null;
          communication_tone: string | null;
          keywords: string | null;
          social_links: string | null;
          bio: string | null;
          created_at: string;
          watermark: string | null;
          campaign_tax_id: string | null;
          candidate_number: string | null;
          voter_id: string | null;
        }>();
      if (!l) return null;
      return rowToCandidate({
        ...l,
        campaign_flags: normalizeList(l.campaign_flags),
        keywords: normalizeList(l.keywords),
        social_links: normalizeSocialLinks(l.social_links),
      });
    },

    async readPublicCandidate(slug) {
      const l = await db
        .prepare(
          `SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
                  location, campaign_flags, communication_tone, keywords, social_links, bio,
                  created_at, watermark, campaign_tax_id, candidate_number, voter_id
           FROM users
           WHERE lower(handle) = lower(?) AND role IN ('voz', 'spokesperson') AND profile_completed = 1 AND is_banned = 0`,
        )
        .bind(slug.trim())
        .first<{
          id: number;
          handle: string;
          name: string;
          avatar_url: string | null;
          political_office: string | null;
          running_for: string | null;
          election_year: string | null;
          location: string | null;
          campaign_flags: string | null;
          communication_tone: string | null;
          keywords: string | null;
          social_links: string | null;
          bio: string | null;
          created_at: string;
          watermark: string | null;
          campaign_tax_id: string | null;
          candidate_number: string | null;
          voter_id: string | null;
        }>();
      if (!l) return null;
      return rowToCandidate({
        ...l,
        campaign_flags: normalizeList(l.campaign_flags),
        keywords: normalizeList(l.keywords),
        social_links: normalizeSocialLinks(l.social_links),
      });
    },

    async readCandidatesByHandles(handles) {
      if (handles.length === 0) return new Map();
      const placeholders = handles.map(() => "?").join(",");
      const { results } = await db
        .prepare(
          `SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
                  location, campaign_flags, communication_tone, keywords, social_links, bio,
                  created_at, watermark, campaign_tax_id, candidate_number, voter_id
           FROM users
           WHERE handle IN (${placeholders})`,
        )
        .bind(...handles)
        .all<{
          id: number;
          handle: string;
          name: string;
          avatar_url: string | null;
          political_office: string | null;
          running_for: string | null;
          election_year: string | null;
          location: string | null;
          campaign_flags: string | null;
          communication_tone: string | null;
          keywords: string | null;
          social_links: string | null;
          bio: string | null;
          created_at: string;
          watermark: string | null;
          campaign_tax_id: string | null;
          candidate_number: string | null;
          voter_id: string | null;
        }>();

      const map = new Map<string, Candidate>();
      for (const r of results) {
        map.set(
          r.handle,
          rowToCandidate({
            ...r,
            campaign_flags: normalizeList(r.campaign_flags),
            keywords: normalizeList(r.keywords),
            social_links: normalizeSocialLinks(r.social_links),
          }),
        );
      }
      return map;
    },
  };
}
