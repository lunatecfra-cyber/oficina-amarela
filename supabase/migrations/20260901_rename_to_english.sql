-- Migração PostgreSQL: renomeação do schema para inglês
-- Fonte da verdade: packages/db/src/migration/legacy-names.ts
-- Ver docs/SCHEMA_LANGUAGE.md

-- Colunas de users
ALTER TABLE IF EXISTS users RENAME COLUMN apelido TO handle;
ALTER TABLE IF EXISTS users RENAME COLUMN nome TO name;
ALTER TABLE IF EXISTS users RENAME COLUMN senha_hash TO password_hash;
ALTER TABLE IF EXISTS users RENAME COLUMN papel TO role;
ALTER TABLE IF EXISTS users RENAME COLUMN criado_em TO created_at;
ALTER TABLE IF EXISTS users RENAME COLUMN sessoes_validas_apos TO sessions_valid_after;
ALTER TABLE IF EXISTS users RENAME COLUMN localizacao TO location;
ALTER TABLE IF EXISTS users RENAME COLUMN entregues TO delivered_count;
ALTER TABLE IF EXISTS users RENAME COLUMN reputacao TO reputation;
ALTER TABLE IF EXISTS users RENAME COLUMN nota TO rating;
ALTER TABLE IF EXISTS users RENAME COLUMN nivel TO tier;
ALTER TABLE IF EXISTS users RENAME COLUMN travado_reservas_ate TO reservations_locked_until;
ALTER TABLE IF EXISTS users RENAME COLUMN banido TO is_banned;
ALTER TABLE IF EXISTS users RENAME COLUMN banido_em TO banned_at;
ALTER TABLE IF EXISTS users RENAME COLUMN motivo_banimento TO ban_reason;
ALTER TABLE IF EXISTS users RENAME COLUMN softwares TO software_tools;
ALTER TABLE IF EXISTS users RENAME COLUMN estilos TO editing_styles;
ALTER TABLE IF EXISTS users RENAME COLUMN link_portfolio TO portfolio_link;
ALTER TABLE IF EXISTS users RENAME COLUMN disponibilidade TO availability;
ALTER TABLE IF EXISTS users RENAME COLUMN perfil_completo TO profile_completed;
ALTER TABLE IF EXISTS users RENAME COLUMN nivel_edicao TO editing_level;
ALTER TABLE IF EXISTS users RENAME COLUMN setup_pc TO pc_setup;
ALTER TABLE IF EXISTS users RENAME COLUMN nicho TO niches;
ALTER TABLE IF EXISTS users RENAME COLUMN foto_url TO avatar_url;
ALTER TABLE IF EXISTS users RENAME COLUMN cargo TO political_office;
ALTER TABLE IF EXISTS users RENAME COLUMN disputa_por TO running_for;
ALTER TABLE IF EXISTS users RENAME COLUMN ano_eleicao TO election_year;
ALTER TABLE IF EXISTS users RENAME COLUMN bandeiras TO campaign_flags;
ALTER TABLE IF EXISTS users RENAME COLUMN tom_comunicacao TO communication_tone;
ALTER TABLE IF EXISTS users RENAME COLUMN palavras_chave TO keywords;
ALTER TABLE IF EXISTS users RENAME COLUMN redes_sociais TO social_links;
ALTER TABLE IF EXISTS users RENAME COLUMN marca_dagua TO watermark;
ALTER TABLE IF EXISTS users RENAME COLUMN cnpj_campanha TO campaign_tax_id;
ALTER TABLE IF EXISTS users RENAME COLUMN titulo_eleitor TO voter_id;
ALTER TABLE IF EXISTS users RENAME COLUMN ultimo_visto_em TO last_seen_at;
ALTER TABLE IF EXISTS users RENAME COLUMN codigo_indicacao TO referral_code;
ALTER TABLE IF EXISTS users RENAME COLUMN indicado_por_id TO referred_by_id;
-- Colunas de pautas
ALTER TABLE IF EXISTS pautas RENAME COLUMN porta_voz_id TO spokesperson_id;
ALTER TABLE IF EXISTS pautas RENAME COLUMN titulo TO title;
ALTER TABLE IF EXISTS pautas RENAME COLUMN formato TO format;
ALTER TABLE IF EXISTS pautas RENAME COLUMN brief_tom TO brief_tone;
ALTER TABLE IF EXISTS pautas RENAME COLUMN brief_cor TO brief_color;
ALTER TABLE IF EXISTS pautas RENAME COLUMN brief_fonte TO brief_font;
ALTER TABLE IF EXISTS pautas RENAME COLUMN video_bruto_url TO raw_video_url;
ALTER TABLE IF EXISTS pautas RENAME COLUMN video_entrega_url TO delivery_video_url;
ALTER TABLE IF EXISTS pautas RENAME COLUMN entrega_link TO delivery_link;
ALTER TABLE IF EXISTS pautas RENAME COLUMN reservada_por_id TO reserved_by_id;
ALTER TABLE IF EXISTS pautas RENAME COLUMN reservada_em TO reserved_at;
ALTER TABLE IF EXISTS pautas RENAME COLUMN reservada_ate TO reserved_until;
ALTER TABLE IF EXISTS pautas RENAME COLUMN notas_inspetor TO inspector_notes;
ALTER TABLE IF EXISTS pautas RENAME COLUMN reedicao_pedida_por TO revision_requested_by;
ALTER TABLE IF EXISTS pautas RENAME COLUMN motivo TO motivation;
ALTER TABLE IF EXISTS pautas RENAME COLUMN prazo_desejado TO desired_deadline;
ALTER TABLE IF EXISTS pautas RENAME COLUMN marca_dagua TO watermark;
ALTER TABLE IF EXISTS pautas RENAME COLUMN cnpj_campanha TO campaign_tax_id;
ALTER TABLE IF EXISTS pautas RENAME COLUMN titulo_eleitor TO voter_id;
ALTER TABLE IF EXISTS pautas RENAME COLUMN prioridade TO priority;
ALTER TABLE IF EXISTS pautas RENAME COLUMN pontuada TO is_scored;
ALTER TABLE IF EXISTS pautas RENAME COLUMN criada_em TO created_at;
-- Colunas de tentativas_login
ALTER TABLE IF EXISTS tentativas_login RENAME COLUMN chave TO key;
ALTER TABLE IF EXISTS tentativas_login RENAME COLUMN tentativas TO attempts;
ALTER TABLE IF EXISTS tentativas_login RENAME COLUMN primeira_em TO first_at;
ALTER TABLE IF EXISTS tentativas_login RENAME COLUMN travado_ate TO locked_until;
-- Colunas de portfolio
ALTER TABLE IF EXISTS portfolio RENAME COLUMN titulo TO title;
ALTER TABLE IF EXISTS portfolio RENAME COLUMN formato TO format;
ALTER TABLE IF EXISTS portfolio RENAME COLUMN porta_voz TO spokesperson;
ALTER TABLE IF EXISTS portfolio RENAME COLUMN link_video TO video_link;
ALTER TABLE IF EXISTS portfolio RENAME COLUMN criado_em TO created_at;
-- Colunas de conquistas
ALTER TABLE IF EXISTS conquistas RENAME COLUMN nome TO name;
ALTER TABLE IF EXISTS conquistas RENAME COLUMN icone TO icon;
ALTER TABLE IF EXISTS conquistas RENAME COLUMN conquistada_em TO earned_at;
-- Colunas de ofertas
ALTER TABLE IF EXISTS ofertas RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE IF EXISTS ofertas RENAME COLUMN oferecida_em TO offered_at;
ALTER TABLE IF EXISTS ofertas RENAME COLUMN respondida_em TO answered_at;
ALTER TABLE IF EXISTS ofertas RENAME COLUMN expira_em TO expires_at;
ALTER TABLE IF EXISTS ofertas RENAME COLUMN ordem TO position;
-- Colunas de fila_emails
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN chave TO key;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN destinatario TO recipient;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN assunto TO subject;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN tentativas TO attempts;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN processar_apos TO process_after;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN enviado_em TO sent_at;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN erro TO error;
ALTER TABLE IF EXISTS fila_emails RENAME COLUMN criado_em TO created_at;
-- Colunas de tarefas_periodicas
ALTER TABLE IF EXISTS tarefas_periodicas RENAME COLUMN nome TO name;
ALTER TABLE IF EXISTS tarefas_periodicas RENAME COLUMN executada_em TO ran_at;
-- Colunas de mensagens
ALTER TABLE IF EXISTS mensagens RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE IF EXISTS mensagens RENAME COLUMN autor_id TO author_id;
ALTER TABLE IF EXISTS mensagens RENAME COLUMN texto TO body;
ALTER TABLE IF EXISTS mensagens RENAME COLUMN criada_em TO created_at;
-- Colunas de denuncias
ALTER TABLE IF EXISTS denuncias RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE IF EXISTS denuncias RENAME COLUMN denunciante_id TO reporter_id;
ALTER TABLE IF EXISTS denuncias RENAME COLUMN denunciado_id TO reported_id;
ALTER TABLE IF EXISTS denuncias RENAME COLUMN texto TO body;
ALTER TABLE IF EXISTS denuncias RENAME COLUMN criada_em TO created_at;
ALTER TABLE IF EXISTS denuncias RENAME COLUMN resolvida_em TO resolved_at;
-- Colunas de avaliacoes
ALTER TABLE IF EXISTS avaliacoes RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE IF EXISTS avaliacoes RENAME COLUMN nota TO rating;
ALTER TABLE IF EXISTS avaliacoes RENAME COLUMN comentario TO comment;
ALTER TABLE IF EXISTS avaliacoes RENAME COLUMN criada_em TO created_at;
-- Colunas de musicas
ALTER TABLE IF EXISTS musicas RENAME COLUMN nome TO name;
ALTER TABLE IF EXISTS musicas RENAME COLUMN tamanho TO size_bytes;
ALTER TABLE IF EXISTS musicas RENAME COLUMN adicionado_por TO added_by;
ALTER TABLE IF EXISTS musicas RENAME COLUMN criado_em TO created_at;
-- Colunas de novidades
ALTER TABLE IF EXISTS novidades RENAME COLUMN titulo TO title;
ALTER TABLE IF EXISTS novidades RENAME COLUMN texto TO body;
ALTER TABLE IF EXISTS novidades RENAME COLUMN publicada TO is_published;
ALTER TABLE IF EXISTS novidades RENAME COLUMN autor_id TO author_id;
ALTER TABLE IF EXISTS novidades RENAME COLUMN criada_em TO created_at;
-- Colunas de gamificacao_regras
ALTER TABLE IF EXISTS gamificacao_regras RENAME COLUMN titulo TO title;
ALTER TABLE IF EXISTS gamificacao_regras RENAME COLUMN descricao TO description;
ALTER TABLE IF EXISTS gamificacao_regras RENAME COLUMN ciclo TO cycle;
ALTER TABLE IF EXISTS gamificacao_regras RENAME COLUMN ativa TO is_active;
-- Colunas de gamificacao_eventos
ALTER TABLE IF EXISTS gamificacao_eventos RENAME COLUMN regra_id TO rule_id;
ALTER TABLE IF EXISTS gamificacao_eventos RENAME COLUMN referencia TO reference;
ALTER TABLE IF EXISTS gamificacao_eventos RENAME COLUMN criado_em TO created_at;
-- Colunas de ranking_ciclos
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN nome TO name;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN inicia_em TO starts_at;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN termina_em TO ends_at;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN congelado_em TO frozen_at;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN max_editores_ativos TO max_active_editors;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN criado_por TO created_by;
ALTER TABLE IF EXISTS ranking_ciclos RENAME COLUMN criado_em TO created_at;
-- Colunas de ranking_aprovacoes
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN pauta_id TO mission_id;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN ciclo_id TO cycle_id;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN aprovado_por TO approved_by;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN aprovado_em TO approved_at;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN anulado_em TO voided_at;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN anulado_por TO voided_by;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME COLUMN motivo_anulacao TO void_reason;
-- Colunas de convites_porta_voz
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN criado_por TO created_by;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN criado_em TO created_at;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN expira_em TO expires_at;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN usado_em TO used_at;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN usado_por TO used_by;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN revogado_em TO revoked_at;
ALTER TABLE IF EXISTS convites_porta_voz RENAME COLUMN revogado_por TO revoked_by;
-- Colunas de indicacoes_recompensas
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN convidado_id TO invitee_id;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN convidador_id TO inviter_id;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN pontos TO points;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN premiado_em TO awarded_at;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN revogado_em TO revoked_at;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME COLUMN motivo_revogacao TO revoke_reason;
-- Colunas de bloqueios_constancia
ALTER TABLE IF EXISTS bloqueios_constancia RENAME COLUMN concedido_por TO granted_by;
ALTER TABLE IF EXISTS bloqueios_constancia RENAME COLUMN motivo TO reason;
ALTER TABLE IF EXISTS bloqueios_constancia RENAME COLUMN concedido_em TO granted_at;
ALTER TABLE IF EXISTS bloqueios_constancia RENAME COLUMN consumido_semana TO consumed_week;
ALTER TABLE IF EXISTS bloqueios_constancia RENAME COLUMN consumido_em TO consumed_at;
-- Colunas de auditoria_admin
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN ator_id TO actor_id;
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN acao TO action;
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN entidade TO entity;
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN entidade_id TO entity_id;
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN detalhes TO details;
ALTER TABLE IF EXISTS auditoria_admin RENAME COLUMN criado_em TO created_at;

-- Tabelas
ALTER TABLE IF EXISTS pautas RENAME TO missions;
ALTER TABLE IF EXISTS mensagens RENAME TO messages;
ALTER TABLE IF EXISTS denuncias RENAME TO reports;
ALTER TABLE IF EXISTS avaliacoes RENAME TO reviews;
ALTER TABLE IF EXISTS ofertas RENAME TO offers;
ALTER TABLE IF EXISTS ranking_ciclos RENAME TO ranking_cycles;
ALTER TABLE IF EXISTS ranking_aprovacoes RENAME TO ranking_approvals;
ALTER TABLE IF EXISTS convites_porta_voz RENAME TO spokesperson_invitations;
ALTER TABLE IF EXISTS indicacoes_recompensas RENAME TO referral_rewards;
ALTER TABLE IF EXISTS bloqueios_constancia RENAME TO consistency_shields;
ALTER TABLE IF EXISTS gamificacao_eventos RENAME TO gamification_events;
ALTER TABLE IF EXISTS gamificacao_regras RENAME TO gamification_rules;
ALTER TABLE IF EXISTS auditoria_admin RENAME TO admin_audit;
ALTER TABLE IF EXISTS fila_emails RENAME TO email_queue;
ALTER TABLE IF EXISTS conquistas RENAME TO achievements;
ALTER TABLE IF EXISTS musicas RENAME TO music_tracks;
ALTER TABLE IF EXISTS novidades RENAME TO news;
ALTER TABLE IF EXISTS tentativas_login RENAME TO login_attempts;
ALTER TABLE IF EXISTS tarefas_periodicas RENAME TO periodic_tasks;
