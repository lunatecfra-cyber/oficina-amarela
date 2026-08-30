# Changelog

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [0.1.0] - 2026-08-30

### Adicionado
- **Ranking Eleitoral 2026**:
  - Ciclos eleitorais com cálculo dinâmico de meta semanal de entregas.
  - Bloqueios de constância (*shields*) para proteger a sequência do editor em semanas atípicas.
  - Vitrine de prêmios coletivos com destravamento por metas de editores ativos.
  - Sorteio por constância com qualificação automática por 4+ semanas consecutivas cumpridas.
- **Programa de Indicações**:
  - Códigos e links de indicação personalizados por editor.
  - Bonificação de reputação (+100 XP) creditada ao convidador após 2 entregas aprovadas do convidado.
- **Convites Exclusivos para Porta-Vozes**:
  - Geração de tokens de convite com hash SHA-256 e expiração em 7 dias.
  - Validação rigorosa de titularidade de e-mail e consumo único.
- **Auditoria e Governança**:
  - Registro de auditoria administrativa (`auditoria_admin`) para criação/revogação de convites, anulação de aprovações e concessão de bloqueios.
- **Backfill e Migração de Dados**:
  - Script idempotente [`scripts/migrar-dados-anteriores.mjs`](./scripts/migrar-dados-anteriores.mjs) para backfill de códigos de indicação e aprovações passadas no ranking.
- **Documentação**:
  - Criação do [`README.md`](./README.md) completo em português com guia de execução, arquitetura, stack e convenções.

### Modificado
- **Padronização da Nomenclatura Interna**:
  - Refatoração de tipos, interfaces, parâmetros, componentes e funções exportadas para inglês (`UserSession`, `Mission`, `EditorProfile`, etc.), mantendo aliases para retrocompatibilidade.
  - Interface do usuário, páginas públicas, rotas visuais, notificações por e-mail e mensagens de erro preservadas 100% em **Português do Brasil (PT-BR)**.
- **Camada de Dados PostgreSQL**:
  - Alinhamento de todas as consultas da pasta `lib/` com o schema canônico de produção do Supabase.

### Corrigido
- **Google OAuth Callback**:
  - Resolução do erro HTTP 500 no endpoint `/api/auth/google/callback` decorrente de divergência de colunas SQL.
- **Consistência de Tipos**:
  - Ajuste nas tipagens de histórico de entregas, conquistas e ranking de editores no módulo de perfil.

