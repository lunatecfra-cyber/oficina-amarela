-- Migração 0003: renomeação do schema para inglês
-- Fonte da verdade: packages/db/src/migration/legacy-names.ts
-- Ver docs/SCHEMA_LANGUAGE.md

-- 1. Derruba gatilhos legados antes de renomear tabelas e colunas
DROP TRIGGER IF EXISTS apply_invitation_redemption;
DROP TRIGGER IF EXISTS apply_mission_approval;
DROP TRIGGER IF EXISTS claim_mission_on_pending_offer;
DROP TRIGGER IF EXISTS reserve_mission_on_offer_accept;
DROP TRIGGER IF EXISTS release_mission_on_offer_close;

-- 2. Renomeia colunas (antes de renomear as tabelas)
-- Colunas de users
ALTER TABLE users RENAME COLUMN apelido TO handle;
ALTER TABLE users RENAME COLUMN nome TO name;
ALTER TABLE users RENAME COLUMN senha_hash TO password_hash;
ALTER TABLE users RENAME COLUMN papel TO role;
ALTER TABLE users RENAME COLUMN criado_em TO created_at;
ALTER TABLE users RENAME COLUMN sessoes_validas_apos TO sessions_valid_after;
ALTER TABLE users RENAME COLUMN localizacao TO location;
ALTER TABLE users RENAME COLUMN entregues TO delivered_count;
ALTER TABLE users RENAME COLUMN reputacao TO reputation;
ALTER TABLE users RENAME COLUMN nota TO rating;
ALTER TABLE users RENAME COLUMN nivel TO tier;
ALTER TABLE users RENAME COLUMN travado_reservas_ate TO reservations_locked_until;
ALTER TABLE users RENAME COLUMN banido TO is_banned;
ALTER TABLE users RENAME COLUMN banido_em TO banned_at;
ALTER TABLE users RENAME COLUMN motivo_banimento TO ban_reason;
ALTER TABLE users RENAME COLUMN softwares TO software_tools;
ALTER TABLE users RENAME COLUMN estilos TO editing_styles;
ALTER TABLE users RENAME COLUMN link_portfolio TO portfolio_link;
ALTER TABLE users RENAME COLUMN disponibilidade TO availability;
ALTER TABLE users RENAME COLUMN perfil_completo TO profile_completed;
ALTER TABLE users RENAME COLUMN nivel_edicao TO editing_level;
ALTER TABLE users RENAME COLUMN setup_pc TO pc_setup;
ALTER TABLE users RENAME COLUMN nicho TO niches;
ALTER TABLE users RENAME COLUMN foto_url TO avatar_url;
ALTER TABLE users RENAME COLUMN cargo TO political_office;
ALTER TABLE users RENAME COLUMN disputa_por TO running_for;
ALTER TABLE users RENAME COLUMN ano_eleicao TO election_year;
ALTER TABLE users RENAME COLUMN bandeiras TO campaign_flags;
ALTER TABLE users RENAME COLUMN tom_comunicacao TO communication_tone;
ALTER TABLE users RENAME COLUMN palavras_chave TO keywords;
ALTER TABLE users RENAME COLUMN redes_sociais TO social_links;
ALTER TABLE users RENAME COLUMN marca_dagua TO watermark;
ALTER TABLE users RENAME COLUMN cnpj_campanha TO campaign_tax_id;
ALTER TABLE users RENAME COLUMN titulo_eleitor TO voter_id;
ALTER TABLE users RENAME COLUMN ultimo_visto_em TO last_seen_at;
ALTER TABLE users RENAME COLUMN codigo_indicacao TO referral_code;
ALTER TABLE users RENAME COLUMN indicado_por_id TO referred_by_id;
-- Colunas de pautas
ALTER TABLE pautas RENAME COLUMN porta_voz_id TO spokesperson_id;
ALTER TABLE pautas RENAME COLUMN titulo TO title;
ALTER TABLE pautas RENAME COLUMN formato TO format;
ALTER TABLE pautas RENAME COLUMN brief_tom TO brief_tone;
ALTER TABLE pautas RENAME COLUMN brief_cor TO brief_color;
ALTER TABLE pautas RENAME COLUMN brief_fonte TO brief_font;
ALTER TABLE pautas RENAME COLUMN video_entrega_url TO delivery_video_url;
ALTER TABLE pautas RENAME COLUMN entrega_link TO delivery_link;
ALTER TABLE pautas RENAME COLUMN reservada_por_id TO reserved_by_id;
ALTER TABLE pautas RENAME COLUMN reservada_em TO reserved_at;
ALTER TABLE pautas RENAME COLUMN reservada_ate TO reserved_until;
ALTER TABLE pautas RENAME COLUMN notas_inspetor TO inspector_notes;
ALTER TABLE pautas RENAME COLUMN reedicao_pedida_por TO revision_requested_by;
ALTER TABLE pautas RENAME COLUMN motivo TO motivation;
ALTER TABLE pautas RENAME COLUMN prazo_desejado TO desired_deadline;
ALTER TABLE pautas RENAME COLUMN marca_dagua TO watermark;
ALTER TABLE pautas RENAME COLUMN cnpj_campanha TO campaign_tax_id;
ALTER TABLE pautas RENAME COLUMN titulo_eleitor TO voter_id;
ALTER TABLE pautas RENAME COLUMN prioridade TO priority;
ALTER TABLE pautas RENAME COLUMN pontuada TO is_scored;
ALTER TABLE pautas RENAME COLUMN criada_em TO created_at;
-- Colunas de tentativas_login
ALTER TABLE tentativas_login RENAME COLUMN chave TO key;
ALTER TABLE tentativas_login RENAME COLUMN tentativas TO attempts;
ALTER TABLE tentativas_login RENAME COLUMN primeira_em TO first_at;
ALTER TABLE tentativas_login RENAME COLUMN travado_ate TO locked_until;
-- Colunas de portfolio
ALTER TABLE portfolio RENAME COLUMN titulo TO title;
ALTER TABLE portfolio RENAME COLUMN formato TO format;
ALTER TABLE portfolio RENAME COLUMN porta_voz TO spokesperson;
ALTER TABLE portfolio RENAME COLUMN link_video TO video_link;
ALTER TABLE portfolio RENAME COLUMN criado_em TO created_at;
-- Colunas de conquistas
ALTER TABLE conquistas RENAME COLUMN nome TO name;
ALTER TABLE conquistas RENAME COLUMN icone TO icon;
ALTER TABLE conquistas RENAME COLUMN conquistada_em TO earned_at;
-- Colunas de ofertas
ALTER TABLE ofertas RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE ofertas RENAME COLUMN oferecida_em TO offered_at;
ALTER TABLE ofertas RENAME COLUMN respondida_em TO answered_at;
ALTER TABLE ofertas RENAME COLUMN expira_em TO expires_at;
ALTER TABLE ofertas RENAME COLUMN ordem TO position;
-- Colunas de fila_emails
ALTER TABLE fila_emails RENAME COLUMN chave TO key;
ALTER TABLE fila_emails RENAME COLUMN destinatario TO recipient;
ALTER TABLE fila_emails RENAME COLUMN assunto TO subject;
ALTER TABLE fila_emails RENAME COLUMN tentativas TO attempts;
ALTER TABLE fila_emails RENAME COLUMN processar_apos TO process_after;
ALTER TABLE fila_emails RENAME COLUMN enviado_em TO sent_at;
ALTER TABLE fila_emails RENAME COLUMN erro TO error;
ALTER TABLE fila_emails RENAME COLUMN criado_em TO created_at;
-- Colunas de mensagens
ALTER TABLE mensagens RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE mensagens RENAME COLUMN autor_id TO author_id;
ALTER TABLE mensagens RENAME COLUMN texto TO body;
ALTER TABLE mensagens RENAME COLUMN criada_em TO created_at;
-- Colunas de denuncias
ALTER TABLE denuncias RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE denuncias RENAME COLUMN denunciante_id TO reporter_id;
ALTER TABLE denuncias RENAME COLUMN denunciado_id TO reported_id;
ALTER TABLE denuncias RENAME COLUMN texto TO body;
ALTER TABLE denuncias RENAME COLUMN criada_em TO created_at;
ALTER TABLE denuncias RENAME COLUMN resolvida_em TO resolved_at;
-- Colunas de avaliacoes
ALTER TABLE avaliacoes RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE avaliacoes RENAME COLUMN nota TO rating;
ALTER TABLE avaliacoes RENAME COLUMN comentario TO comment;
ALTER TABLE avaliacoes RENAME COLUMN criada_em TO created_at;
-- Colunas de musicas
ALTER TABLE musicas RENAME COLUMN nome TO name;
ALTER TABLE musicas RENAME COLUMN tamanho TO size_bytes;
ALTER TABLE musicas RENAME COLUMN adicionado_por TO added_by;
ALTER TABLE musicas RENAME COLUMN criado_em TO created_at;
-- Colunas de novidades
ALTER TABLE novidades RENAME COLUMN titulo TO title;
ALTER TABLE novidades RENAME COLUMN texto TO body;
ALTER TABLE novidades RENAME COLUMN publicada TO is_published;
ALTER TABLE novidades RENAME COLUMN autor_id TO author_id;
ALTER TABLE novidades RENAME COLUMN criada_em TO created_at;
-- Colunas de gamificacao_regras
ALTER TABLE gamificacao_regras RENAME COLUMN titulo TO title;
ALTER TABLE gamificacao_regras RENAME COLUMN descricao TO description;
ALTER TABLE gamificacao_regras RENAME COLUMN ciclo TO cycle;
ALTER TABLE gamificacao_regras RENAME COLUMN ativa TO is_active;
-- Colunas de gamificacao_eventos
ALTER TABLE gamificacao_eventos RENAME COLUMN regra_id TO rule_id;
ALTER TABLE gamificacao_eventos RENAME COLUMN referencia TO reference;
ALTER TABLE gamificacao_eventos RENAME COLUMN criado_em TO created_at;
-- Colunas de ranking_ciclos
ALTER TABLE ranking_ciclos RENAME COLUMN nome TO name;
ALTER TABLE ranking_ciclos RENAME COLUMN inicia_em TO starts_at;
ALTER TABLE ranking_ciclos RENAME COLUMN termina_em TO ends_at;
ALTER TABLE ranking_ciclos RENAME COLUMN congelado_em TO frozen_at;
ALTER TABLE ranking_ciclos RENAME COLUMN max_editores_ativos TO max_active_editors;
ALTER TABLE ranking_ciclos RENAME COLUMN criado_por TO created_by;
-- Colunas de ranking_aprovacoes
ALTER TABLE ranking_aprovacoes RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE ranking_aprovacoes RENAME COLUMN ciclo_id TO cycle_id;
ALTER TABLE ranking_aprovacoes RENAME COLUMN aprovado_por TO approved_by;
ALTER TABLE ranking_aprovacoes RENAME COLUMN aprovado_em TO approved_at;
ALTER TABLE ranking_aprovacoes RENAME COLUMN anulado_em TO voided_at;
ALTER TABLE ranking_aprovacoes RENAME COLUMN anulado_por TO voided_by;
ALTER TABLE ranking_aprovacoes RENAME COLUMN motivo_anulacao TO void_reason;
-- Colunas de convites_porta_voz
ALTER TABLE convites_porta_voz RENAME COLUMN criado_por TO created_by;
ALTER TABLE convites_porta_voz RENAME COLUMN criado_em TO created_at;
ALTER TABLE convites_porta_voz RENAME COLUMN expira_em TO expires_at;
ALTER TABLE convites_porta_voz RENAME COLUMN usado_em TO used_at;
ALTER TABLE convites_porta_voz RENAME COLUMN usado_por TO used_by;
ALTER TABLE convites_porta_voz RENAME COLUMN revogado_em TO revoked_at;
ALTER TABLE convites_porta_voz RENAME COLUMN revogado_por TO revoked_by;
-- Colunas de indicacoes_recompensas
ALTER TABLE indicacoes_recompensas RENAME COLUMN convidado_id TO invitee_id;
ALTER TABLE indicacoes_recompensas RENAME COLUMN convidador_id TO inviter_id;
ALTER TABLE indicacoes_recompensas RENAME COLUMN pontos TO points;
ALTER TABLE indicacoes_recompensas RENAME COLUMN premiado_em TO awarded_at;
ALTER TABLE indicacoes_recompensas RENAME COLUMN revogado_em TO revoked_at;
ALTER TABLE indicacoes_recompensas RENAME COLUMN motivo_revogacao TO revoke_reason;
-- Colunas de bloqueios_constancia
ALTER TABLE bloqueios_constancia RENAME COLUMN concedido_por TO granted_by;
ALTER TABLE bloqueios_constancia RENAME COLUMN motivo TO reason;
ALTER TABLE bloqueios_constancia RENAME COLUMN concedido_em TO granted_at;
ALTER TABLE bloqueios_constancia RENAME COLUMN consumido_semana TO consumed_week;
ALTER TABLE bloqueios_constancia RENAME COLUMN consumido_em TO consumed_at;
-- Colunas de auditoria_admin
ALTER TABLE auditoria_admin RENAME COLUMN ator_id TO actor_id;
ALTER TABLE auditoria_admin RENAME COLUMN acao TO action;
ALTER TABLE auditoria_admin RENAME COLUMN entidade TO entity;
ALTER TABLE auditoria_admin RENAME COLUMN entidade_id TO entity_id;
ALTER TABLE auditoria_admin RENAME COLUMN detalhes TO details;
ALTER TABLE auditoria_admin RENAME COLUMN criado_em TO created_at;
-- Colunas de invitation_redemptions
ALTER TABLE invitation_redemptions RENAME COLUMN apelido TO handle;
ALTER TABLE invitation_redemptions RENAME COLUMN nome TO name;
ALTER TABLE invitation_redemptions RENAME COLUMN senha_hash TO password_hash;
ALTER TABLE invitation_redemptions RENAME COLUMN foto_url TO avatar_url;
ALTER TABLE invitation_redemptions RENAME COLUMN codigo_indicacao TO referral_code;
ALTER TABLE invitation_redemptions RENAME COLUMN resgatado_em TO redeemed_at;
-- Colunas de mission_approvals
ALTER TABLE mission_approvals RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE mission_approvals RENAME COLUMN aprovado_por TO approved_by;
ALTER TABLE mission_approvals RENAME COLUMN aprovado_em TO approved_at;
ALTER TABLE mission_approvals RENAME COLUMN nota TO rating;
ALTER TABLE mission_approvals RENAME COLUMN comentario TO comment;

-- 3. Renomeia tabelas
ALTER TABLE pautas RENAME TO missions;
ALTER TABLE mensagens RENAME TO messages;
ALTER TABLE denuncias RENAME TO reports;
ALTER TABLE avaliacoes RENAME TO reviews;
ALTER TABLE ofertas RENAME TO offers;
ALTER TABLE ranking_ciclos RENAME TO ranking_cycles;
ALTER TABLE ranking_aprovacoes RENAME TO ranking_approvals;
ALTER TABLE convites_porta_voz RENAME TO spokesperson_invitations;
ALTER TABLE indicacoes_recompensas RENAME TO referral_rewards;
ALTER TABLE bloqueios_constancia RENAME TO consistency_shields;
ALTER TABLE gamificacao_eventos RENAME TO gamification_events;
ALTER TABLE gamificacao_regras RENAME TO gamification_rules;
ALTER TABLE auditoria_admin RENAME TO admin_audit;
ALTER TABLE fila_emails RENAME TO email_queue;
ALTER TABLE conquistas RENAME TO achievements;
ALTER TABLE musicas RENAME TO music_tracks;
ALTER TABLE novidades RENAME TO news;
ALTER TABLE tentativas_login RENAME TO login_attempts;

-- 4. Recria gatilhos com os nomes novos
CREATE TRIGGER IF NOT EXISTS apply_invitation_redemption
AFTER INSERT ON invitation_redemptions
BEGIN
  INSERT INTO users (
    handle, name, email, password_hash, google_id, role, avatar_url, referred_by_id
  ) VALUES (
    NEW.handle, NEW.name, NEW.email, NEW.password_hash, NEW.google_id, 'voz', NEW.avatar_url,
    (SELECT id FROM users WHERE referral_code = NEW.referral_code)
  );
  UPDATE spokesperson_invitations
  SET used_at = NEW.redeemed_at,
      used_by = (SELECT id FROM users WHERE lower(email) = lower(NEW.email))
  WHERE token_hash = NEW.token_hash AND used_at IS NULL AND revoked_at IS NULL;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'invitation_unavailable') END;
  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  SELECT created_by, 'convite_consumido', 'spokesperson_invitation', CAST(id AS TEXT),
         json_object('email', NEW.email, 'user_id', used_by), NEW.redeemed_at
  FROM spokesperson_invitations WHERE token_hash = NEW.token_hash;
END;

CREATE TRIGGER IF NOT EXISTS apply_mission_approval
AFTER INSERT ON mission_approvals
BEGIN
  UPDATE missions
  SET status = NEW.status_final, inspector_notes = NULL,
      revision_requested_by = NULL, is_scored = 1
  WHERE id = NEW.mission_id AND status = 'em_revisao' AND is_scored = 0;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_not_in_review') END;

  INSERT INTO reviews (mission_id, editor_id, rating, comment)
  SELECT NEW.mission_id, NEW.editor_id, NEW.rating, nullif(trim(NEW.comment), '')
  WHERE NEW.rating IS NOT NULL;

  UPDATE users
  SET delivered_count = delivered_count + 1, reputation = reputation + 25, streak = streak + 1
  WHERE id = NEW.editor_id;
  UPDATE users
  SET rating = (SELECT round(avg(rating), 2) FROM reviews WHERE editor_id = NEW.editor_id)
  WHERE id = NEW.editor_id;

  INSERT INTO ranking_approvals (
    mission_id, cycle_id, editor_id, approved_by, approved_at
  )
  SELECT NEW.mission_id, id, NEW.editor_id, NEW.approved_by, NEW.approved_at
  FROM ranking_cycles
  WHERE frozen_at IS NULL
    AND NEW.approved_at BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC LIMIT 1
  ON CONFLICT (mission_id) DO UPDATE SET
    cycle_id = excluded.cycle_id,
    editor_id = excluded.editor_id,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    voided_at = NULL,
    voided_by = NULL,
    void_reason = NULL
  WHERE ranking_approvals.voided_at IS NOT NULL;

  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  VALUES (
    NEW.approved_by, 'edicao_aprovada', 'mission', CAST(NEW.mission_id AS TEXT),
    json_object('editorId', NEW.editor_id), NEW.approved_at
  );

  INSERT OR IGNORE INTO referral_rewards (
    invitee_id, inviter_id, awarded_at
  )
  SELECT NEW.editor_id, referred_by_id, NEW.approved_at
  FROM users
  WHERE id = NEW.editor_id AND referred_by_id IS NOT NULL
    AND (SELECT count(*) FROM ranking_approvals
         WHERE editor_id = NEW.editor_id AND voided_at IS NULL) >= 2
    AND (SELECT count(*) FROM referral_rewards
         WHERE inviter_id = users.referred_by_id AND revoked_at IS NULL
           AND awarded_at >= substr(NEW.approved_at, 1, 7) || '-01T00:00:00.000Z') < 5;
  UPDATE users SET reputation = reputation + 100
  WHERE id = (SELECT inviter_id FROM referral_rewards
              WHERE invitee_id = NEW.editor_id)
    AND changes() = 1;
END;

CREATE TRIGGER IF NOT EXISTS claim_mission_on_pending_offer
AFTER INSERT ON offers
WHEN NEW.status = 'pendente'
BEGIN
  UPDATE missions SET status = 'oferecida'
  WHERE id = NEW.mission_id AND status IN ('disponivel', 'oferecida');
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_unavailable') END;
END;

CREATE TRIGGER IF NOT EXISTS reserve_mission_on_offer_accept
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status = 'aceita'
BEGIN
  UPDATE missions
  SET status = 'reservada', reserved_by_id = NEW.editor_id,
      reserved_at = NEW.answered_at
  WHERE id = NEW.mission_id AND status = 'oferecida';
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'offer_invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS release_mission_on_offer_close
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status IN ('rejeitada', 'expirada')
BEGIN
  UPDATE missions SET status = 'disponivel'
  WHERE id = NEW.mission_id AND status = 'oferecida';
END;
