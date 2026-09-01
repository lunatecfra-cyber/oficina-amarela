# Changelog

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [0.2.0] - 2026-09-01

### Adicionado
- A plataforma inteira passa a rodar na Cloudflare. O Next virou Worker por `vinext`, a API virou um Worker separado em Hono, e o web fala com ela por Service Binding — de Worker para Worker, sem sair para a internet.
- Banco em Cloudflare D1, com PostgreSQL mantido como alternativa. A escolha é decidida pela presença do binding e vale para o conjunto inteiro de repositórios, nunca fatia a fatia.
- Dois editores que pegam a mesma missão no mesmo instante são resolvidos por um Durable Object, e não mais por corrida no banco.
- Manutenção deixou de depender de tráfego: uma Cloudflare Queue com fila de descarte e um Cron de um minuto cuidam dela.
- E-mail sai por uma caixa de saída no banco. Enfileirar é uma escrita, então um provedor fora do ar não derruba mais o cadastro nem a recuperação de senha.
- Área do porta-voz, identidade de campanha e conformidade eleitoral.
- Ferramenta de migração de PostgreSQL para D1, com ensaio sobre dados reais, validação de paridade e carga direta num D1 remoto.
- Backup completo do banco, com a restauração ensaiada e não apenas descrita.
- Instrumentação das consultas ao D1 e telemetria no Analytics Engine.

### Modificado
- Identificador é em inglês em todo lugar: código, classe de CSS, tabela e coluna de banco. Texto que alguém lê continua em português.
- Os aliases de retrocompatibilidade acabaram. Não existe mais dois ou três nomes exportados para a mesma coisa, nem chave duplicada no JSON da API.
- Autorização passou a ser explícita na fronteira HTTP, no lugar das políticas RLS do PostgreSQL.
- O hash do convite de porta-voz saiu de `node:crypto` para a Web Crypto, que existe nos três ambientes que carregam o domínio. Os convites já emitidos continuam válidos.
- README reescrito, com a arquitetura que está no ar.

### Corrigido
- A recuperação de senha não deixa mais descobrir se um e-mail tem conta.
- O papel da conta não pode mais ser escolhido por quem se cadastra.
- No painel do inspetor, os botões de avisar editores e porta-vozes voltaram a enviar: o painel mandava um formato e a rota exigia outro, e todo clique dava erro.
- Três classes de CSS não existiam em arquivo nenhum. Os cartões de escolha de papel na home ficavam sem o efeito de vidro, e o círculo do ícone da área de upload ficava sem fundo.
- A home saiu do caminho caro de renderização e voltou a ser servida de cache.
- O molde do e-mail de comunicado escapa o nome e o texto, que antes entravam como marcação viva.
- A revogação de sessão segue o banco escolhido para o ambiente, em vez de procurar sempre no PostgreSQL.
- As migrações de dados paravam na primeira e nenhuma das seguintes rodava.

### Removido
- Vercel Blob, cujo último uso saiu junto com a migração para o R2.
- As políticas RLS, substituídas pela autorização na fronteira.

## [0.1.1] - 2026-08-30

### Corrigido
- **Título do Site e Metadados Globais**:
  - Atualizado o título padrão no `layout.tsx` para **Oficina Amarela** (substituindo "Yellow Workshop").
  - Atualizada a descrição padrão para português ("A Confraria dos Editores de Vídeo. Pegue missões, entregue cortes e suba de nível.").
  - Ajustado atributo de linguagem HTML para `pt-BR`.
  - Corrigidos links de criação de conta na página inicial para apontar para rotas em português (`/criar-conta?papel=voz` e `/criar-conta?papel=editor`).

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

