# Changelog

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [0.3.0] - 2026-09-04

### Adicionado
- Webmail serverless open-source implantado em `mail.oficinaamarela.com.br` integrado ao Cloudflare Email Routing e Email Sending (`apps/mail`).
- Identidade visual customizada com a marca da Oficina Amarela / Casa Amarela (paleta escura, acentos dourados, emblema oficial e tipografia Cinzel e Sora).
- Sistema de internacionalização (i18n) completo com tradução para Português do Brasil (PT-BR) por padrão e alternador dinâmico de idiomas no cabeçalho e configurações.
- Roteamento ativo de entrada e caixas postais para os endereços da equipe (`contato@`, `thiago@`, `vitor@`, `admin@`, `suporte@`, `ola@`, `info@`) com armazenamento em Cloudflare R2 e Durable Objects (SQLite).

## [0.2.3] - 2026-09-04

### Modificado
- A branch `codex/ranking-eleitoral` está formalmente registrada como incorporada: todo o conteúdo dela (área do porta-voz, identidade de campanha, alvos de toque de 44px e rótulos de acessibilidade) já tinha sido adaptado para o monorepo em inglês e publicado nas versões 0.2.0–0.2.2. Nenhuma mudança de código nesta versão.

## [0.2.2] - 2026-09-03

### Adicionado
- Cobertura que faltava do trabalho de ranking eleitoral: e-mails do backend agora têm teste próprio garantindo que só linkam página pública em PT-BR (`/porta-voz/missao/db-…`, `/porta-voz/nova-pauta`) — a conferência de links do web só enxerga o que navega, e corpo de e-mail nunca navega.
- Regras de produto trancadas junto das migrações: R2 nas tabelas de produção em português, coluna legada antes da função eleitoral, funções privadas com `SECURITY INVOKER` e revogadas do público, proporções de XP (25/100), evento registrado na entrega e texto do painel diário.

## [0.2.1] - 2026-09-03

### Corrigido
- A migração PostgreSQL→D1 traduz o vocabulário na passagem: a origem continua em português e o D1 já fala inglês, mas a carga, a conferência de colunas e o backfill de eventos assumiam nomes iguais nas duas pontas — contra o D1 de produção a migração quebrava com tabela ausente. O ensaio agora aplica o esquema completo (0001+0002+0003) em vez de só o 0001, então o que passa no ensaio passa na produção.
- Datas vindas do pooler (Supabase/Neon) chegavam como texto com espaço (`2026-08-30 12:00:00+00`) e entravam no D1 fora do ISO-8601 ordenável. A conversão agora normaliza toda data para ISO UTC.
- O relatório do backfill de eventos mentia no destino remoto (sempre zero linhas carregadas), porque o D1 remoto acumula escritas e responde `changes: 0` por linha. A contagem agora é antes-depois, com descarga forçada.
- A fila de manutenção cabia na cota diária da conta: staging e produção varrendo a cada minuto gastavam 172,8% das 10.000 operações/dia de Queue, e todo dia por volta das 13h53 UTC a manutenção parava até a meia-noite. Cron espaçado (produção a cada 5 min, staging a cada 15), um tique vira uma mensagem só, e com a fila indisponível a manutenção roda em linha em vez de estourar.
- O script de aplicação do esquema D1 mandava gatilho por `--command`, que o wrangler corta no primeiro `;` — o ensaio em staging perdeu as cinco travas de concorrência e ficou sem gatilho nenhum. Gatilho agora vai por `--file`, com repetição em erro transitório de autenticação.

### Modificado
- Carga no D1 local usa `batch()` (um roundtrip por lote em vez de um por linha); no remoto o caminho por linha continua, que é o que o acumulador espera.
- Ensaio de migração aceita `--tabelas a,b` para carregar só as tabelas pedidas, mostra progresso no destino remoto e religa os gatilhos se for interrompido no meio.
- Dependências atualizadas (Next 16.3.4, Hono 4.13, Wrangler 4.128, Sentry, Vinext, Turbo 2.10, AWS SDK, Miniflare).

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

