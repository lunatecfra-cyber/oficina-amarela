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
        .prepare("SELECT headline, bio, localizacao, whatsapp, senha_hash FROM users WHERE id = ?")
        .bind(userId)
        .first<{
          headline: string | null;
          bio: string | null;
          localizacao: string | null;
          whatsapp: string | null;
          senha_hash: string | null;
        }>();
      if (!row) return null;
      return {
        headline: normalizeList(row.headline),
        bio: row.bio ?? null,
        location: row.localizacao ?? null,
        whatsapp: row.whatsapp ?? null,
        hasPassword: Boolean(row.senha_hash),
        temSenha: Boolean(row.senha_hash),
        localizacao: row.localizacao ?? null,
      };
    },

    async saveEditableProfile(userId, data) {
      try {
        const loc = data.location ?? data.localizacao;
        const headlineJson = data.headline ? JSON.stringify(limitList(data.headline, 5)) : null;
        await db
          .prepare(
            "UPDATE users SET headline = ?, bio = ?, localizacao = ?, whatsapp = ? WHERE id = ?",
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
            `SELECT nome, foto_url, localizacao, headline, bio, softwares, estilos, nivel_edicao,
                    setup_pc, link_portfolio, whatsapp, nicho, disponibilidade, perfil_completo
             FROM users WHERE id = ?`,
          )
          .bind(userId)
          .first<{
            nome: string | null;
            foto_url: string | null;
            localizacao: string | null;
            headline: string | null;
            bio: string | null;
            softwares: string | null;
            estilos: string | null;
            nivel_edicao: string | null;
            setup_pc: string | null;
            link_portfolio: string | null;
            whatsapp: string | null;
            nicho: string | null;
            disponibilidade: string | null;
            perfil_completo: number | null;
          }>();
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
          whatsapp: row.whatsapp ?? undefined,
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

      const headlineJson = data.headline ? JSON.stringify(limitList(data.headline, 5)) : null;
      const toolsJson = rawTools ? JSON.stringify(limitList(rawTools, 12)) : null;
      const stylesJson = rawStyles ? JSON.stringify(limitList(rawStyles, 3)) : null;
      const nichesJson = rawNiches ? JSON.stringify(limitList(rawNiches, 4)) : null;
      const newGridJson = rawAvail ? JSON.stringify(rawAvail) : null;

      await db
        .prepare(
          `UPDATE users SET
             nome = ?,
             foto_url = ?,
             localizacao = ?,
             headline = ?,
             bio = ?,
             softwares = ?,
             estilos = ?,
             nivel_edicao = ?,
             setup_pc = ?,
             link_portfolio = ?,
             whatsapp = ?,
             nicho = ?,
             disponibilidade = COALESCE(?, disponibilidade),
             perfil_completo = 1
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
          : "SELECT * FROM users WHERE lower(apelido) = lower(?)";

        const account = await db
          .prepare(accountQuery)
          .bind(isNumeric ? handleOrId : String(handleOrId).trim())
          .first<{
            id: number;
            apelido: string;
            nome: string;
            headline: string | null;
            bio: string | null;
            localizacao: string | null;
            criado_em: string;
            entregues: number | null;
            reputacao: number | null;
            streak: number | null;
            nota: number | null;
            nivel: string | null;
            foto_url: string | null;
            softwares: string | null;
            estilos: string | null;
            nicho: string | null;
            nivel_edicao: string | null;
            setup_pc: string | null;
          }>();
        if (!account) return null;

        const [portfolioRes, achievementRes, deliveryRes] = await Promise.all([
          db
            .prepare(
              "SELECT id, titulo, formato, porta_voz, tint, link_video FROM portfolio WHERE user_id = ? ORDER BY criado_em DESC",
            )
            .bind(account.id)
            .all<{
              id: number;
              titulo: string;
              formato: "short" | "longo";
              porta_voz: string;
              tint: string | null;
              link_video: string | null;
            }>(),
          db
            .prepare(
              "SELECT nome, icone FROM conquistas WHERE user_id = ? ORDER BY conquistada_em DESC",
            )
            .bind(account.id)
            .all<{ nome: string; icone: string | null }>(),
          db
            .prepare(
              `SELECT p.id, p.titulo, p.status, p.criada_em, u.nome AS porta_voz
               FROM pautas p
               JOIN users u ON u.id = p.porta_voz_id
               WHERE p.reservada_por_id = ?
                 AND p.status IN ('aprovada', 'finalizada', 'reedicao')
               ORDER BY p.criada_em DESC`,
            )
            .bind(account.id)
            .all<{
              id: number;
              titulo: string;
              status: string;
              criada_em: string;
              porta_voz: string;
            }>(),
        ]);

        const portfolio: PortfolioItem[] = portfolioRes.results.map((i) => ({
          id: `pf-${i.id}`,
          title: i.titulo,
          format: i.formato,
          spokesperson: i.porta_voz,
          tint: i.tint ?? "linear-gradient(135deg,#3a3a42,#12121a)",
          titulo: i.titulo,
          formato: i.formato,
          portaVoz: i.porta_voz,
        }));

        const history: HistoryItem[] = deliveryRes.results.map((h) => {
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

        const achievements = achievementRes.results.map((m) => ({
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
        console.error("[profile-d1] error reading editor profile:", err);
        return null;
      }
    },

    async readEditorRanking(limit = 10) {
      const { results } = await db
        .prepare(
          `SELECT id, apelido, nome, foto_url, entregues, reputacao, streak, nota, nivel
           FROM users
           WHERE papel = 'editor' AND perfil_completo = 1
           ORDER BY entregues DESC, reputacao DESC, criado_em ASC
           LIMIT ?`,
        )
        .bind(limit)
        .all<{
          id: number;
          apelido: string;
          nome: string;
          foto_url: string | null;
          entregues: number | null;
          reputacao: number | null;
          streak: number | null;
          nota: number | null;
          nivel: string | null;
        }>();
      return results.map((r) => ({
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

      await db
        .prepare("UPDATE users SET disponibilidade = ? WHERE id = ?")
        .bind(JSON.stringify(grid.map((l: unknown[]) => l.map(Boolean))), userId)
        .run();
      return { ok: true };
    },

    async readCandidateOnboarding(userId) {
      const l = await db
        .prepare(
          `SELECT nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
                  bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
                  perfil_completo, marca_dagua, cnpj_campanha, candidate_number, titulo_eleitor, whatsapp
           FROM users WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          nome: string | null;
          foto_url: string | null;
          cargo: string | null;
          disputa_por: string | null;
          ano_eleicao: string | null;
          localizacao: string | null;
          bandeiras: string | null;
          tom_comunicacao: string | null;
          palavras_chave: string | null;
          redes_sociais: string | null;
          bio: string | null;
          perfil_completo: number | null;
          marca_dagua: string | null;
          cnpj_campanha: string | null;
          candidate_number: string | null;
          titulo_eleitor: string | null;
          whatsapp: string | null;
        }>();
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
        candidateNumber: l.candidate_number ?? undefined,
        whatsapp: l.whatsapp ?? undefined,
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
        numeroEleitoral: l.candidate_number ?? undefined,
        tituloEleitor: l.titulo_eleitor ?? undefined,
      };
    },

    async saveCandidateOnboarding(userId, data) {
      // Mesma regra do PostgreSQL: nome oficial, número na urna e CNPJ da
      // campanha viram a tarja de propaganda, que é obrigação legal.
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
             nome = ?,
             foto_url = ?,
             cargo = ?,
             disputa_por = ?,
             ano_eleicao = ?,
             localizacao = ?,
             bandeiras = ?,
             tom_comunicacao = ?,
             palavras_chave = ?,
             redes_sociais = ?,
             bio = ?,
             marca_dagua = ?,
             cnpj_campanha = ?,
             candidate_number = ?,
             whatsapp = ?,
             titulo_eleitor = ?,
             perfil_completo = 1
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
          `SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
                  localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
                  criado_em, marca_dagua, cnpj_campanha, candidate_number, titulo_eleitor
           FROM users
           WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          id: number;
          apelido: string;
          nome: string;
          foto_url: string | null;
          cargo: string | null;
          disputa_por: string | null;
          ano_eleicao: string | null;
          localizacao: string | null;
          bandeiras: string | null;
          tom_comunicacao: string | null;
          palavras_chave: string | null;
          redes_sociais: string | null;
          bio: string | null;
          criado_em: string;
          marca_dagua: string | null;
          cnpj_campanha: string | null;
          candidate_number: string | null;
          titulo_eleitor: string | null;
        }>();
      if (!l) return null;
      return rowToCandidate({
        ...l,
        bandeiras: normalizeList(l.bandeiras),
        palavras_chave: normalizeList(l.palavras_chave),
        redes_sociais: normalizeSocialLinks(l.redes_sociais),
      });
    },

    async readPublicCandidate(slug) {
      const l = await db
        .prepare(
          `SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
                  localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
                  criado_em, marca_dagua, cnpj_campanha, candidate_number, titulo_eleitor
           FROM users
           WHERE lower(apelido) = lower(?) AND papel IN ('voz', 'spokesperson') AND perfil_completo = 1 AND banido = 0`,
        )
        .bind(slug.trim())
        .first<{
          id: number;
          apelido: string;
          nome: string;
          foto_url: string | null;
          cargo: string | null;
          disputa_por: string | null;
          ano_eleicao: string | null;
          localizacao: string | null;
          bandeiras: string | null;
          tom_comunicacao: string | null;
          palavras_chave: string | null;
          redes_sociais: string | null;
          bio: string | null;
          criado_em: string;
          marca_dagua: string | null;
          cnpj_campanha: string | null;
          candidate_number: string | null;
          titulo_eleitor: string | null;
        }>();
      if (!l) return null;
      return rowToCandidate({
        ...l,
        bandeiras: normalizeList(l.bandeiras),
        palavras_chave: normalizeList(l.palavras_chave),
        redes_sociais: normalizeSocialLinks(l.redes_sociais),
      });
    },

    async readCandidatesByHandles(handles) {
      if (handles.length === 0) return new Map();
      const placeholders = handles.map(() => "?").join(",");
      const { results } = await db
        .prepare(
          `SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
                  localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
                  criado_em, marca_dagua, cnpj_campanha, candidate_number, titulo_eleitor
           FROM users
           WHERE apelido IN (${placeholders})`,
        )
        .bind(...handles)
        .all<{
          id: number;
          apelido: string;
          nome: string;
          foto_url: string | null;
          cargo: string | null;
          disputa_por: string | null;
          ano_eleicao: string | null;
          localizacao: string | null;
          bandeiras: string | null;
          tom_comunicacao: string | null;
          palavras_chave: string | null;
          redes_sociais: string | null;
          bio: string | null;
          criado_em: string;
          marca_dagua: string | null;
          cnpj_campanha: string | null;
          candidate_number: string | null;
          titulo_eleitor: string | null;
        }>();

      const map = new Map<string, Candidate>();
      for (const r of results) {
        map.set(
          r.apelido,
          rowToCandidate({
            ...r,
            bandeiras: normalizeList(r.bandeiras),
            palavras_chave: normalizeList(r.palavras_chave),
            redes_sociais: normalizeSocialLinks(r.redes_sociais),
          }),
        );
      }
      return map;
    },
  };
}
