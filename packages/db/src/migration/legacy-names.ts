/**
 * De-para entre o vocabulário antigo do banco (PT-BR) e o novo (inglês).
 *
 * O schema nasceu em português. A regra do projeto é que identificador —
 * inclusive nome de tabela e de coluna — fica em inglês, e a decisão foi
 * renomear também o que já existia. Ver docs/SCHEMA_LANGUAGE.md.
 *
 * Este arquivo é a ÚNICA fonte da verdade do de-para. Dele saem:
 *   - as migrações de renomeação (PostgreSQL e D1), geradas, não digitadas;
 *   - a tradução na carga PostgreSQL → D1, que precisa ler de uma origem que
 *     ainda fala português e escrever num destino que já fala inglês.
 *
 * Esse último ponto é o que faz a migração de verdade continuar possível: o
 * Supabase em produção NÃO é renomeado — renomear coluna de um banco que
 * atende a aplicação no ar quebraria a aplicação no ar. Ele continua em
 * português, e a tradução acontece na passagem.
 *
 * Valor de linha não entra aqui. `status = 'disponivel'` e `papel = 'voz'` são
 * DADO, não identificador: renomear exigiria reescrever todas as linhas e a
 * restrição CHECK junto, e o domínio já aceita as duas grafias na fronteira.
 */

/** Tabelas que mudaram de nome. As ausentes já estavam em inglês. */
export const LEGACY_TABLES: Record<string, string> = {
  pautas: "missions",
  mensagens: "messages",
  denuncias: "reports",
  avaliacoes: "reviews",
  ofertas: "offers",
  ranking_ciclos: "ranking_cycles",
  ranking_aprovacoes: "ranking_approvals",
  convites_porta_voz: "spokesperson_invitations",
  indicacoes_recompensas: "referral_rewards",
  bloqueios_constancia: "consistency_shields",
  gamificacao_eventos: "gamification_events",
  gamificacao_regras: "gamification_rules",
  auditoria_admin: "admin_audit",
  fila_emails: "email_queue",
  conquistas: "achievements",
  musicas: "music_tracks",
  novidades: "news",
  tentativas_login: "login_attempts",
  tarefas_periodicas: "periodic_tasks",
};

/**
 * Colunas por tabela, na chave do nome ANTIGO da tabela.
 *
 * Os nomes novos não foram inventados aqui: são os que o domínio já usava do
 * lado do TypeScript (`campaignTaxId`, `voterId`, `avatarUrl`, `deliveredCount`).
 * O banco passa a falar a mesma língua que o código, e a camada de tradução
 * que existia dentro dos repositórios encolhe em vez de crescer.
 */
export const LEGACY_COLUMNS: Record<string, Record<string, string>> = {
  users: {
    apelido: "handle",
    nome: "name",
    senha_hash: "password_hash",
    papel: "role",
    criado_em: "created_at",
    sessoes_validas_apos: "sessions_valid_after",
    localizacao: "location",
    entregues: "delivered_count",
    reputacao: "reputation",
    nota: "rating",
    nivel: "tier",
    travado_reservas_ate: "reservations_locked_until",
    banido: "is_banned",
    banido_em: "banned_at",
    motivo_banimento: "ban_reason",
    softwares: "software_tools",
    estilos: "editing_styles",
    link_portfolio: "portfolio_link",
    disponibilidade: "availability",
    perfil_completo: "profile_completed",
    nivel_edicao: "editing_level",
    setup_pc: "pc_setup",
    nicho: "niches",
    foto_url: "avatar_url",
    cargo: "political_office",
    disputa_por: "running_for",
    ano_eleicao: "election_year",
    bandeiras: "campaign_flags",
    tom_comunicacao: "communication_tone",
    palavras_chave: "keywords",
    redes_sociais: "social_links",
    marca_dagua: "watermark",
    cnpj_campanha: "campaign_tax_id",
    titulo_eleitor: "voter_id",
    ultimo_visto_em: "last_seen_at",
    codigo_indicacao: "referral_code",
    indicado_por_id: "referred_by_id",
  },
  pautas: {
    porta_voz_id: "spokesperson_id",
    titulo: "title",
    formato: "format",
    brief_tom: "brief_tone",
    brief_cor: "brief_color",
    brief_fonte: "brief_font",
    video_bruto_url: "raw_video_url",
    video_entrega_url: "delivery_video_url",
    entrega_link: "delivery_link",
    reservada_por_id: "reserved_by_id",
    reservada_em: "reserved_at",
    reservada_ate: "reserved_until",
    notas_inspetor: "inspector_notes",
    reedicao_pedida_por: "revision_requested_by",
    motivo: "motivation",
    prazo_desejado: "desired_deadline",
    marca_dagua: "watermark",
    cnpj_campanha: "campaign_tax_id",
    titulo_eleitor: "voter_id",
    prioridade: "priority",
    pontuada: "is_scored",
    criada_em: "created_at",
  },
  tentativas_login: {
    chave: "key",
    tentativas: "attempts",
    primeira_em: "first_at",
    travado_ate: "locked_until",
  },
  portfolio: {
    titulo: "title",
    formato: "format",
    porta_voz: "spokesperson",
    link_video: "video_link",
    criado_em: "created_at",
  },
  conquistas: {
    nome: "name",
    icone: "icon",
    conquistada_em: "earned_at",
  },
  ofertas: {
    pauta_id: "mission_id",
    oferecida_em: "offered_at",
    respondida_em: "answered_at",
    expira_em: "expires_at",
    ordem: "position",
  },
  fila_emails: {
    chave: "key",
    destinatario: "recipient",
    assunto: "subject",
    tentativas: "attempts",
    processar_apos: "process_after",
    enviado_em: "sent_at",
    erro: "error",
    criado_em: "created_at",
  },
  tarefas_periodicas: {
    nome: "name",
    executada_em: "ran_at",
  },
  mensagens: {
    pauta_id: "mission_id",
    autor_id: "author_id",
    texto: "body",
    criada_em: "created_at",
  },
  denuncias: {
    pauta_id: "mission_id",
    denunciante_id: "reporter_id",
    denunciado_id: "reported_id",
    texto: "body",
    criada_em: "created_at",
    resolvida_em: "resolved_at",
  },
  avaliacoes: {
    pauta_id: "mission_id",
    nota: "rating",
    comentario: "comment",
    criada_em: "created_at",
  },
  musicas: {
    nome: "name",
    tamanho: "size_bytes",
    adicionado_por: "added_by",
    criado_em: "created_at",
  },
  novidades: {
    titulo: "title",
    texto: "body",
    publicada: "is_published",
    autor_id: "author_id",
    criada_em: "created_at",
  },
  gamificacao_regras: {
    titulo: "title",
    descricao: "description",
    ciclo: "cycle",
    ativa: "is_active",
  },
  gamificacao_eventos: {
    regra_id: "rule_id",
    referencia: "reference",
    criado_em: "created_at",
  },
  ranking_ciclos: {
    nome: "name",
    inicia_em: "starts_at",
    termina_em: "ends_at",
    congelado_em: "frozen_at",
    max_editores_ativos: "max_active_editors",
    criado_por: "created_by",
    criado_em: "created_at",
  },
  ranking_aprovacoes: {
    pauta_id: "mission_id",
    ciclo_id: "cycle_id",
    aprovado_por: "approved_by",
    aprovado_em: "approved_at",
    anulado_em: "voided_at",
    anulado_por: "voided_by",
    motivo_anulacao: "void_reason",
  },
  convites_porta_voz: {
    criado_por: "created_by",
    criado_em: "created_at",
    expira_em: "expires_at",
    usado_em: "used_at",
    usado_por: "used_by",
    revogado_em: "revoked_at",
    revogado_por: "revoked_by",
  },
  indicacoes_recompensas: {
    convidado_id: "invitee_id",
    convidador_id: "inviter_id",
    pontos: "points",
    premiado_em: "awarded_at",
    revogado_em: "revoked_at",
    motivo_revogacao: "revoke_reason",
  },
  bloqueios_constancia: {
    concedido_por: "granted_by",
    motivo: "reason",
    concedido_em: "granted_at",
    consumido_semana: "consumed_week",
    consumido_em: "consumed_at",
  },
  auditoria_admin: {
    ator_id: "actor_id",
    acao: "action",
    entidade: "entity",
    entidade_id: "entity_id",
    detalhes: "details",
    criado_em: "created_at",
  },
  invitation_redemptions: {
    apelido: "handle",
    nome: "name",
    senha_hash: "password_hash",
    foto_url: "avatar_url",
    codigo_indicacao: "referral_code",
    resgatado_em: "redeemed_at",
  },
  mission_approvals: {
    pauta_id: "mission_id",
    aprovado_por: "approved_by",
    aprovado_em: "approved_at",
    nota: "rating",
    comentario: "comment",
  },
};

/** Nome novo de uma tabela; a própria tabela quando ela já estava em inglês. */
export function renamedTable(legacy: string): string {
  return LEGACY_TABLES[legacy] ?? legacy;
}

/** Nome novo de uma coluna, dada a tabela no nome ANTIGO. */
export function renamedColumn(legacyTable: string, legacyColumn: string): string {
  return LEGACY_COLUMNS[legacyTable]?.[legacyColumn] ?? legacyColumn;
}

/** O caminho inverso: do nome novo para o antigo, para ler a origem legada. */
export function legacyColumnOf(legacyTable: string, newColumn: string): string {
  const columns = LEGACY_COLUMNS[legacyTable];
  if (!columns) return newColumn;
  for (const [legacy, renamed] of Object.entries(columns)) {
    if (renamed === newColumn) return legacy;
  }
  return newColumn;
}
