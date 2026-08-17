# 🏭 Oficina Amarela — Documentação Completa do Projeto

> **Última atualização:** 17/08/2026
> **Versão:** 0.1.0
> **URL de produção:** https://oficinaamarela.com.br
> **Repositório GitHub:** https://github.com/lunatecfra-cyber/oficina-amarela

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Stack Técnica](#-stack-técnica)
3. [Arquitetura](#-arquitetura)
4. [Estrutura de Pastas](#-estrutura-de-pastas)
5. [Sistema de Autenticação](#-sistema-de-autenticação)
6. [Papéis e Permissões](#-papéis-e-permissões)
7. [Banco de Dados (Schema)](#-banco-de-dados-schema)
8. [Fluxo de Missões (Pautas)](#-fluxo-de-missões-pautas)
9. [Sistema de Fila (Dispatch)](#-sistema-de-fila-dispatch)
10. [Sistema de Chat](#-sistema-de-chat)
11. [Páginas e Rotas](#-páginas-e-rotas)
12. [APIs (Endpoints)](#-apis-endpoints)
13. [Componentes](#-componentes)
14. [Módulos da Lib](#-módulos-da-lib)
15. [Ferramentas (Video Editors)](#-ferramentas-video-editors)
16. [Biblioteca de Músicas](#-biblioteca-de-músicas)
17. [Sistema de Ranking e Níveis](#-sistema-de-ranking-e-níveis)
18. [Sistema de Novidades](#-sistema-de-novidades)
19. [Onboarding e Guias](#-onboarding-e-guias)
20. [Deploy e Infraestrutura](#-deploy-e-infraestrutura)
21. [Variáveis de Ambiente](#-variáveis-de-ambiente)
22. [Como Rodar Localmente](#-como-rodar-localmente)
23. [Como Clonar e Configurar em Outro PC](#-como-clonar-e-configurar-em-outro-pc)
24. [Convenções de Código](#-convenções-de-código)
25. [Funcionalidades Implementadas](#-funcionalidades-implementadas)
26. [Funcionalidades Pendentes/Futuras](#-funcionalidades-pendentesfuturas)

---

## 🌟 Visão Geral

A **Oficina Amarela** é uma plataforma que conecta **candidatos políticos** (porta-vozes) a **editores de vídeo**. O candidato cria uma "missão" (pauta) com o briefing do vídeo que precisa, e a plataforma despacha automaticamente para editores disponíveis. O editor aceita a missão, faz o corte, entrega, e o candidato revisa e aprova.

**Três papéis:**
- **Porta-voz (voz):** Candidato político que cria missões de vídeo
- **Editor:** Editor de vídeo que aceita e executa missões
- **Inspetor (admin):** Gerencia a plataforma, fila, usuários e qualidade

---

## 🛠 Stack Técnica

| Tecnologia | Versão | Uso |
|---|---|---|
| **Next.js** | 16.3.0 (App Router) | Framework web full-stack |
| **React** | 19.2.4 | UI |
| **TypeScript** | 5 | Linguagem |
| **Tailwind CSS** | v4 | Estilização |
| **PostgreSQL** | (Supabase/Neon) | Banco de dados |
| **postgres.js** | ^3.4.9 | Driver SQL (sem ORM) |
| **jose** | ^6.2.7 | JWT (auth) |
| **bcryptjs** | ^3.0.3 | Hash de senhas |
| **Resend** | ^6.18.1 | E-mails transacionais |
| **@vercel/blob** | ^2.8.0 | Armazenamento de arquivos |
| **@sentry/nextjs** | ^10.70.0 | Monitoramento de erros |
| **Vercel** | CLI 59+ | Deploy e hosting |

**Fonte principal:** Cinzel (via `font-[family-name:var(--font-display)]`)

**Tema visual:** Ouro/dourado com gradientes, `text-gold-hi`, cards `rounded-2xl`, fundo escuro.

---

## 🏗 Arquitetura

### Padrão principal: Dupla client/server por domínio

Cada domínio tem dois módulos:
1. **Módulo client-safe** (ex: `lib/pautas.ts`): Tipos, constantes, dados demo, funções puras. Pode ser importado por componentes `"use client"`.
2. **Módulo server-only** (ex: `lib/pautas-db.ts`): Queries SQL reais. **Nunca** importado por código client.

### Decisões arquiteturais importantes

- **Sem ORM:** SQL puro via tagged template literals do `postgres.js`
- **Sem WebSockets:** Presence via polling (`ultimo_visto_em`, janela de 3 minutos)
- **Dispatch estilo Uber:** Um editor por missão, expira em 5 minutos, concorrência via índices parciais únicos
- **Rate limiting no Postgres:** Como instâncias serverless do Vercel têm memória independente, rate limiters em memória não funcionariam entre instâncias
- **bcrypt timing-constant:** Previne ataques de enumeração de contas por timing
- **Conexão lazy:** `obterClient()` só conecta na primeira query, permitindo `npm run build` sem `DATABASE_URL`
- **`prepare: false` no postgres.js:** Obrigatório com o pooler do Supabase em modo "transaction"

### Fluxo de dados

```
[Porta-voz cria missão] → POST /api/pautas → lib/pautas-db.ts (INSERT)
    → [Fila] lib/fila-db.ts (despacharMissoes) → cria oferta
    → [Editor aceita] → PUT /api/editor/fila/proxima → lib/fila-db.ts (aceitarOferta)
    → [Editor entrega] → PUT /api/pautas/[id] → lib/pautas-db.ts (entregarPauta)
    → [Porta-voz aprova] → PUT /api/pautas/[id] → lib/pautas-db.ts (aprovarPauta)
```

---

## 📁 Estrutura de Pastas

```
oficina-amarela/
├── .agents/skills/          # Skills do ZCode (IA)
├── .zcode/                  # Configuração do ZCode
├── app/                     # Rotas Next.js (App Router)
│   ├── api/                 # API routes
│   │   ├── admin/           # APIs do inspetor
│   │   ├── auth/            # APIs de autenticação
│   │   ├── conta/           # APIs de conta
│   │   ├── editor/          # APIs do editor
│   │   ├── ferramentas/     # APIs de ferramentas
│   │   ├── pautas/          # APIs de missões
│   │   ├── perfil/          # APIs de perfil
│   │   ├── porta-voz/       # APIs do porta-voz
│   │   └── vagas/           # API de vagas
│   ├── aulas/               # Página de aulas
│   ├── candidato/[slug]/    # Perfil público do candidato
│   ├── criar-conta/         # Registro
│   ├── dev/                 # Ferramentas de debug
│   ├── editor/              # Área do editor
│   ├── escolher-papel/      # Seleção de papel
│   ├── ferramentas/         # Página de ferramentas
│   ├── inspetor/            # Área do inspetor
│   ├── login/               # Login
│   ├── parceiros/           # Parceiros
│   ├── porta-voz/           # Área do porta-voz
│   ├── perfil/              # Perfil do editor
│   ├── ranking/             # Ranking público
│   └── ...                  # Outras páginas públicas
├── components/              # Componentes React
├── lib/                     # Módulos TypeScript
├── public/                  # Arquivos estáticos
├── scripts/                 # Scripts utilitários
├── supabase/               # Schema SQL do banco
├── AGENTS.md               # Instruções pro ZCode
├── proxy.ts                # Middleware de autenticação (proxy.ts, não middleware.ts)
├── next.config.ts          # Configuração Next.js
├── tailwind.config.ts      # Configuração Tailwind (v4)
├── tsconfig.json           # Configuração TypeScript
├── package.json            # Dependências
└── .gitignore              # Arquivos ignorados pelo git
```

---

## 🔐 Sistema de Autenticação

### Como funciona

1. **Cookie JWT:** Login salva um cookie `confraria_sessao` com JWT assinado (HS256, 30 dias)
2. **Dupla validação:**
   - **Edge (proxy.ts):** Verifica assinatura do JWT. Rápida, roda no edge.
   - **Server (sessao-servidor.ts):** Verifica JWT + consulta `sessoes_validas_apos` no banco para rejeitar tokens emitidos antes de troca de senha.
3. **Google OAuth:** Fluxo completo com estado assinado (anti-CSRF), identidade pendente em cookie

### Fluxos de autenticação

| Fluxo | Endpoint | Descrição |
|---|---|---|
| Login email/senha | `POST /api/auth/login` | Verifica credenciais, retorna cookie JWT |
| Login Google | `GET /api/auth/google` → callback → registrar | OAuth 2.0 completo |
| Registro | `POST /api/auth/cadastro` | Cria conta com apelido, email, senha |
| Logout | `POST /api/auth/logout` | Limpa cookie |
| Recuperar senha | `POST /api/auth/recuperar` | Envia email com link de recuperação |
| Redefinir senha | `POST /api/auth/redefinir-senha` | Troca senha via token temporário |
| Verificar sessão | `GET /api/auth/sessao` | Retorna dados do usuário logado |
| Dev login | `POST /api/auth/dev-login` | Login sem senha (só desenvolvimento) |

### Segurança

- **bcrypt com timing constante:** Hash dummy para contas inexistentes (evita enumeração por timing)
- **Rate limiting no banco:** 5 tentativas por apelido, 30 por IP
- **Ban + kill session:** `sessoes_validas_apos = now()` invalida todos os tokens
- **Verificação de ban:** Só após a senha bater (não revela se conta existe antes)

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/sessao.ts` | Cria/verifica JWT, tokens de recuperação, estado OAuth (Edge-compatible) |
| `lib/sessao-servidor.ts` | `lerSessao()`, `exigirSessao()` — validação server-side com DB |
| `lib/contas.ts` | Cadastro, autenticação, bcrypt, rate limiting, Google linking |
| `proxy.ts` | Middleware — guarda de rota por papel, redireciona deslogados |

---

## 👥 Papéis e Permissões

| Papel | Valor no DB | Acesso |
|---|---|---|
| **Porta-voz** | `voz` | `/porta-voz/*`, `/perfil/*`, `/ranking/*`, `/aulas/*`, `/ferramentas/*` |
| **Editor** | `editor` | `/editor/*`, `/perfil/*`, `/agenda/*`, `/ranking/*`, `/aulas/*`, `/ferramentas/*` |
| **Inspetor** | `admin` | Todas as rotas (`/inspetor/*`, `/admin/*` e tudo mais) |

### Regras do middleware (proxy.ts)

- **Sem sessão:** Redireciona para `/login`
- **Voz tentando acessar área do editor:** Redireciona para `/porta-voz`
- **Editor tentando acessar área do porta-voz:** Redireciona para `/editor`
- **Voz/Editor tentando `/inspetor`:** Redireciona para sua área
- **Admin:** Acesso total
- **Dev bypass:** Em desenvolvimento (sem Vercel), permite acesso livre

---

## 🗄 Banco de Dados (Schema)

**Arquivo:** `supabase/schema.sql`
**Provider:** Supabase/Neon (PostgreSQL)
**Connection:** `postgres.js` com `prepare: false` (pooler transaction mode)

### Tabelas

#### `users` — Usuários
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
apelido         TEXT UNIQUE NOT NULL
nome            TEXT NOT NULL
email           TEXT UNIQUE NOT NULL
senha_hash      TEXT              -- nulo se login via Google
google_id       TEXT UNIQUE       -- nulo se login via email
papel           TEXT NOT NULL DEFAULT 'voz' CHECK (papel IN ('voz','editor','admin'))
headline        TEXT
bio             TEXT
localizacao     TEXT
entregues       INT NOT NULL DEFAULT 0
reputacao       NUMERIC(5,2) NOT NULL DEFAULT 0
streak          INT NOT NULL DEFAULT 0
nota            NUMERIC(3,1)         -- média das avaliações
nivel           INT GENERATED ALWAYS AS (
  CASE WHEN entregues >= 60 THEN 4
       WHEN entregues >= 30 THEN 3
       WHEN entregues >= 10 THEN 2
       ELSE 1 END
) STORED
travado_reservas_ate TIMESTAMPTZ  -- lock após muitas recusas
banido          BOOLEAN NOT NULL DEFAULT false
banido_em       TIMESTAMPTZ
motivo_banimento TEXT
softwares       TEXT[]             -- lista de softwares que usa
estilos         TEXT[]             -- estilos de edição
portfolio_link  TEXT
disponibilidade JSONB              -- grade 3x7 (3 períodos × 7 dias)
perfil_completo BOOLEAN NOT NULL DEFAULT false
nivel_edicao    TEXT
setup_pc        TEXT
nicho           TEXT[]
foto_url        TEXT
cargo           TEXT                -- cargo político
disputa_por     TEXT                -- cargo que disputa
ano_eleicao     INT
bandeiras       TEXT[]              -- bandeiras/temas políticos
tom_comunicacao TEXT
palavras_chave  TEXT[]
redes_sociais   JSONB              -- { instagram, tiktok, youtube, twitter, website }
ultimo_visto_em TIMESTAMPTZ        -- para presença (editor online)
sessoes_validas_apos TIMESTAMPTZ  -- invalida tokens antigos
```

#### `pautas` — Missões
```sql
id              UUID PRIMARY KEY
porta_voz_id    UUID NOT NULL REFERENCES users(id)
titulo          TEXT NOT NULL
formato         TEXT CHECK IN ('short','longo')
drive_link      TEXT
youtube_link    TEXT               -- link do YouTube (opcional, adicionado recentemente)
extras          TEXT                -- cortes específicos
tom             TEXT
cor             TEXT
fonte           TEXT
refs            TEXT
motivo          TEXT                -- contexto
prazo           TEXT
status          TEXT NOT NULL DEFAULT 'disponivel'
  -- disponivel, oferecida, reservada, em_revisao, reedicao, aprovada, finalizada
prioridade      INT DEFAULT 999
editor_id       UUID REFERENCES users(id)
editor_nome     TEXT
reservada_em    TIMESTAMPTZ
entregue_em     TIMESTAMPTZ
entrega_link    TEXT
aprovada_em     TIMESTAMPTZ
criada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `ofertas` — Ofertas de missão (dispatch)
```sql
id              UUID PRIMARY KEY
pauta_id        UUID NOT NULL REFERENCES pautas(id)
editor_id       UUID NOT NULL REFERENCES users(id)
status          TEXT NOT NULL DEFAULT 'pendente'
  -- pendente, aceita, rejeitada, expirada
criada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
-- Índices parciais únicos:
-- Uma oferta pendente por pauta
-- Uma oferta pendente por editor
-- Ofertas expiram após 5 minutos (MINUTOS_OFERTA)
```

#### `avaliacoes` — Avaliações
```sql
id              UUID PRIMARY KEY
pauta_id        UUID NOT NULL REFERENCES pautas(id)
autor_id        UUID NOT NULL REFERENCES users(id)
nota            INT NOT NULL CHECK (nota BETWEEN 1 AND 5)
pontuada        BOOLEAN NOT NULL DEFAULT false  -- se contou pra reputação
criada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `mensagens` — Chat
```sql
id              UUID PRIMARY KEY
pauta_id        UUID NOT NULL REFERENCES pautas(id)
autor_id        UUID NOT NULL REFERENCES users(id)
autor_nome      TEXT NOT NULL
autor_papel     TEXT NOT NULL
texto           TEXT NOT NULL
criada_em       TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `denuncias` — Denúncias
```sql
id, pauta_id, autor_id, texto, resolvida, criada_em, resolvida_em
```

#### `musicas` — Biblioteca de músicas
```sql
id, titulo, artista, url, tags TEXT[], criada_em
```

#### `portfolio` — Portfolio de editores
```sql
id, editor_id, titulo, descricao, url, criada_em
```

#### `conquistas` — Conquistas/badges
```sql
id, usuario_id, tipo, criada_em
```

#### `tentativas_login` — Rate limiting
```sql
id, apelido, ip, criada_em
```

---

## 📋 Fluxo de Missões (Pautas)

### Ciclo de vida de uma missão

```
1. CRIADA (disponivel)
   Porta-voz preenche briefing com 5 passos:
   - Passo 0: Vídeo bruto (Drive e/ou YouTube) + título
   - Passo 1: Cortes específicos (opcional)
   - Passo 2: Estilo (tom, cor, fonte, referências)
   - Passo 3: Contexto (motivo da missão)
   - Passo 4: Formato (Short 9:16 ou Longo 16:9)
   
   → POST /api/pautas → status: disponivel

2. DESPACHADA (oferecida)
   Sistema automático (fila-db.ts) busca editores disponíveis
   e cria oferta. Um editor por missão. Expira em 5 min.
   
   → lib/fila-db.ts:despacharMissoes()

3. ACEITA (reservada)
   Editor aceita a oferta. Missão fica "em mãos".
   
   → PUT /api/editor/fila/proxima (aceitar)

4. ENTREGUE (em_revisao)
   Editor faz o vídeo e envia link de entrega.
   
   → PUT /api/pautas/[id] (entregar)

5. APROVADA (aprovada / finalizada)
   Porta-voz revisa e aprova. Incrementa entregas/reputação.
   
   → PUT /api/pautas/[id] (aprovar)

   OU

5b. REEDIÇÃO (reedicao)
   Porta-voz pede ajustes. Volta pro editor.
   
   → PUT /api/pautas/[id] (pedirReedicao)
```

### Links do vídeo bruto

- **Drive:** Campo opcional, validado com `pareceLinkDrive()` (regex `drive.google.com`)
- **YouTube:** Campo opcional, validado com `pareceLinkYoutube()` (regex `youtube.com|youtu.be`)
- **Regra:** Pelo menos um dos dois precisa estar preenchido
- Ambos são exibidos em: missao-em-maos, porta-voz/missao/[id], mesa-agora, oferta-missao

---

## 🚀 Sistema de Fila (Dispatch)

**Arquivo:** `lib/fila-db.ts`
**Modelo:** Estilo Uber — despacho automático, um editor por missão.

### Como funciona

1. **`despacharMissoes()`** — chamada periodicamente:
   - Busca até 20 missões `disponivel`
   - Para cada, encontra o editor mais qualificado via CTE
   - Cria oferta. Se violar índice único → outro editor já ganhou (concorrência)

2. **Critério de seleção do editor (`proximoEditor`):**
   - Editor com entregas prévias pro mesmo porta-voz (match)
   - Total de entregues DESC (experiência)
   - `ultimo_visto_em` ASC (justiça — quem espera mais tempo)
   - Filtros: ativo há < 3 min, não travado, grade de disponibilidade bate, sem missão atual, sem oferta pendente

3. **Expiração:** Ofertas pendentes de > 5 min são marcadas como `expirada`

4. **Fluxo do editor:**
   - `GET /api/editor/fila/proxima` → retorna oferta pendente ou "sem missão"
   - Editor aceita → `status: reservada`
   - Editor recusa → `status: rejeitada`, próxima oferta criada

---

## 💬 Sistema de Chat

**Arquivo:** `lib/chat-db.ts`, `components/chat-missao.tsx`

### Funcionalidades

- Chat por missão (pauta), entre porta-voz, editor e inspetor
- **Auto-refresh:** Polling a cada 5 segundos via `setInterval`
- **Pause inteligente:** Pausa polling quando a aba está oculta (`document.visibilityState`)
- **Auto-scroll:** Scrolla pra última mensagem automaticamente
- **URLs clicáveis:** Qualquer URL (`https://...`) no texto vira link clicável (abre em nova aba)
- **Controle de acesso:** Só o dono da missão, editor designado ou admin podem enviar mensagens

### Polling

```
- A cada 5s: GET mensagens após a última recebida
- Se aba oculta: pausa polling
- Se aba volta: retoma polling + busca imediata
```

---

## 📄 Páginas e Rotas

### Páginas Públicas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `app/page.tsx` | Landing page |
| `/login` | `app/login/page.tsx` | Login (email+senha ou Google) |
| `/criar-conta` | `app/criar-conta/page.tsx` | Registro |
| `/escolher-papel` | `app/escolher-papel/page.tsx` | Seleção voz/editor |
| `/recuperar` | `app/recuperar/page.tsx` | Recuperar senha |
| `/redefinir-senha` | `app/redefinir-senha/page.tsx` | Redefinir senha |
| `/ranking` | `app/ranking/page.tsx` | Ranking público de editores |
| `/aulas` | `app/aulas/page.tsx` | Tutoriais/aulas |
| `/parceiros` | `app/parceiros/page.tsx` | Parceiros |
| `/candidato/[slug]` | `app/candidato/[slug]/page.tsx` | Perfil público do candidato |
| `/privacidade` | `app/privacidade/page.tsx` | Política de privacidade |
| `/termos` | `app/termos/page.tsx` | Termos de uso |
| `/dev` | `app/dev/page.tsx` | Ferramentas de debug |

### Área do Porta-Voz

| Rota | Arquivo | Descrição |
|---|---|---|
| `/porta-voz` | `app/porta-voz/page.tsx` | Dashboard (minhas missões) |
| `/porta-voz/criar-perfil` | `app/porta-voz/criar-perfil/page.tsx` | Onboarding do candidato |
| `/porta-voz/nova-pauta` | `app/porta-voz/nova-pauta/page.tsx` | Criar nova missão (5 passos) |
| `/porta-voz/missao/[id]` | `app/porta-voz/missao/[id]/page.tsx` | Detalhe da missão (chat, aprovar) |
| `/porta-voz/perfil` | `app/porta-voz/perfil/page.tsx` | Perfil do candidato |
| `/porta-voz/perfil/editar` | `app/porta-voz/perfil/editar/page.tsx` | Editar perfil |

### Área do Editor

| Rota | Arquivo | Descrição |
|---|---|---|
| `/editor` | `app/editor/page.tsx` | Dashboard (aceitar missão, ver fila) |
| `/editor/criar-perfil` | `app/editor/criar-perfil/page.tsx` | Onboarding do editor |
| `/perfil` | `app/perfil/page.tsx` | Perfil do editor |
| `/perfil/editar` | `app/perfil/editar/page.tsx` | Editar perfil |
| `/agenda` | `app/agenda/page.tsx` | Grade de disponibilidade (3×7) |
| `/ferramentas` | `app/ferramentas/page.tsx` | Ferramentas (video editors + músicas) |
| `/ferramentas/musicas` | `app/ferramentas/musicas/page.tsx` | Biblioteca de músicas |

### Área do Inspetor

| Rota | Arquivo | Descrição |
|---|---|---|
| `/inspetor` | `app/inspetor/page.tsx` | Dashboard (fila de revisão) |
| `/inspetor/panorama` | `app/inspetor/panorama/page.tsx` | Panorama geral do sistema |
| `/inspetor/contas` | `app/inspetor/contas/page.tsx` | Gerenciar contas |
| `/inspetor/denuncias` | `app/inspetor/denuncias/page.tsx` | Ver denúncias |
| `/inspetor/novidades` | `app/inspetor/novidades/page.tsx` | Gerenciar novidades |

---

## 🔌 APIs (Endpoints)

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/login` | Login email/senha |
| `POST` | `/api/auth/cadastro` | Criar conta |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/auth/recuperar` | Solicitar recuperação de senha |
| `POST` | `/api/auth/redefinir-senha` | Redefinir senha |
| `GET` | `/api/auth/sessao` | Dados da sessão atual |
| `GET` | `/api/auth/google` | Iniciar OAuth Google |
| `GET` | `/api/auth/google/callback` | Callback OAuth Google |
| `POST` | `/api/auth/google/registrar` | Registrar via Google |
| `POST` | `/api/auth/dev-login` | Login dev (sem senha) |

### Missões (Pautas)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/pautas` | Criar missão |
| `GET` | `/api/pautas/[id]` | Detalhes da missão |
| `PUT` | `/api/pautas/[id]` | Ações: reservar, cancelar, entregar, aprovar, pedir reedição |

### Editor

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/editor/fila/proxima` | Poll próxima oferta |
| `PUT` | `/api/editor/fila/proxima` | Aceitar/recusar oferta |
| `GET` | `/api/editor/perfil` | Ler perfil |
| `PUT` | `/api/editor/perfil` | Salvar perfil |
| `PUT` | `/api/editor/disponibilidade` | Salvar grade de disponibilidade |

### Perfil

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/perfil` | Ler perfil |
| `PUT` | `/api/perfil` | Editar perfil |
| `GET` | `/api/porta-voz/perfil` | Ler perfil candidato |
| `PUT` | `/api/porta-voz/perfil` | Editar perfil candidato |

### Admin/Inspetor

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/usuarios` | Buscar usuários |
| `GET` | `/api/admin/usuarios/[id]` | Detalhes do usuário |
| `PUT` | `/api/admin/usuarios/[id]` | Banir/desbanir/deletar |
| `GET` | `/api/admin/fila` | Ver fila |
| `PUT` | `/api/admin/fila` | Mover na fila |
| `GET` | `/api/admin/novidades` | Listar novidades |
| `POST` | `/api/admin/novidades` | Criar novidade |
| `PUT` | `/api/admin/novidades` | Alternar publicação |
| `DELETE` | `/api/admin/novidades` | Apagar novidade |
| `GET` | `/api/admin/denuncias` | Listar denúncias |
| `PUT` | `/api/admin/denuncias` | Resolver denúncia |
| `GET` | `/api/admin/pautas/[id]` | Detalhes da missão (admin) |
| `POST` | `/api/admin/avisar` | Enviar notificação |

### Outros

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/vagas` | Vagas disponíveis por papel |
| `GET` | `/api/conta` | Dados da própria conta |
| `DELETE` | `/api/conta` | Deletar própria conta |
| `PUT` | `/api/conta/senha` | Trocar senha |
| `GET` | `/api/ferramentas/musicas` | Listar músicas |
| `POST` | `/api/ferramentas/musicas` | Adicionar música |

---

## 🧩 Componentes

### Componentes principais

| Componente | Arquivo | Descrição |
|---|---|---|
| `NovaPautaForm` | `components/nova-pauta-form.tsx` | Formulário de 5 passos para criar missão |
| `ChatMissao` | `components/chat-missao.tsx` | Chat por missão (polling, auto-scroll, URLs clicáveis) |
| `MissaoEmMaos` | `components/missao-em-maos.tsx` | Card de missão aceita pelo editor |
| `MesaAgora` | `components/mesa-agora.tsx` | Fila de missões na mesa do editor |
| `OfertaMissao` | `components/oferta-missao.tsx` | Card de oferta de missão (aceitar/recusar) |
| `BannerPerfilIncompleto` | `components/banner-perfil-incompleto.tsx` | Alerta pra completar perfil |
| `BibliotecaMusicas` | `components/biblioteca-musicas.tsx` | Catálogo de músicas com filtros |
| `ListaFerramentas` | `components/lista-ferramentas.tsx` | Lista de 8 video editors |
| `TutorialDrive` | `components/tutorial-drive.tsx` | Tutorial interativo do Drive |
| `EscolherPapelForm` | `components/escolher-papel-form.tsx` | Formulário de escolha de papel |
| `NavEditor` | `components/nav-editor.tsx` | Navegação do editor |
| `PainelContas` | `components/painel-contas.tsx` | Painel de gestão de contas (inspetor) |
| `PainelPanorama` | `components/painel-panorama.tsx` | Panorama do sistema (inspetor) |

---

## 📚 Módulos da Lib

### Módulos Client-Safe (importáveis por "use client")

| Arquivo | Descrição |
|---|---|
| `lib/pautas.ts` | Tipos (`Pauta`, `Editor`, `StatusPauta`), rótulos, etapas, dados demo |
| `lib/perfil.ts` | Tipos de perfil, softwares, estilos, níveis, headlines, dados demo |
| `lib/candidatos.ts` | Tipos de candidato, dados demo, cidades/estados do Brasil |
| `lib/agenda.ts` | Tipos da agenda, dias/períodos, grade de disponibilidade |
| `lib/guia.ts` | Guias de onboarding (10 roteiros), passo-a-passo interativo |
| `lib/tutoriais.ts` | URLs de tutoriais em vídeo, utilitário de embed |
| `lib/novidades.ts` | Dados demo de novidades |
| `lib/cidades-br.ts` | 5.570 municípios brasileiros (IBGE) |
| `lib/validators.ts` | `pareceLink()`, `pareceLinkDrive()`, `pareceLinkYoutube()` |
| `lib/limites.ts` | Limites de campos, vagas, tamanho de foto |
| `lib/comprimir-foto.ts` | Compressão de foto client-side (canvas → WebP) |
| `lib/sentry-comum.ts` | Config compartilhado do Sentry |
| `lib/oauth-google.ts` | Config e helpers do Google OAuth |

### Módulos Server-Only (NUNCA importar no client)

| Arquivo | Descrição |
|---|---|
| `lib/db.ts` | Conexão PostgreSQL (wrapper lazy `sql`) |
| `lib/sessao.ts` | JWT Edge-compatible (criar/verificar tokens) |
| `lib/sessao-servidor.ts` | Validação de sessão server-side (com DB) |
| `lib/contas.ts` | Cadastro, login, bcrypt, rate limiting, Google |
| `lib/admin-usuarios.ts` | CRUD de usuários (inspetor), ban, delete |
| `lib/pautas-db.ts` | CRUD de missões, ciclo completo |
| `lib/fila-db.ts` | Dispatch automático, ofertas, editores online |
| `lib/chat-db.ts` | Chat (mensagens, polling, controle de acesso) |
| `lib/perfil-db.ts` | Perfil do editor (CRUD, ranking) |
| `lib/candidato-db.ts` | Perfil do candidato (CRUD, onboarding) |
| `lib/denuncias-db.ts` | Denúncias (criar, listar, resolver) |
| `lib/painel-db.ts` | Panorama (resumo, fila, missões em voo) |
| `lib/novidades-db.ts` | Novidades (CRUD, publicação) |
| `lib/musicas-db.ts` | Músicas (listar, adicionar, tags) |
| `lib/email.ts` | Envio de e-mails (Resend), notificações |
| `lib/ip.ts` | Extração de IP da requisição |

---

## 🎬 Ferramentas (Video Editors)

**Página:** `/ferramentas`
**Arquivo:** `components/lista-ferramentas.tsx`

8 editores de vídeo listados, cada um com:
- Nome, descrição, ícone
- Link externo
- Tags/categorias

### Fluxo

1. Porta-voz ou editor acessa `/ferramentas`
2. Vê lista de 8 editores de vídeo organizados em cards
3. Clica no editor desejado → abre site externo

---

## 🎵 Biblioteca de Músicas

**Página:** `/ferramentas/musicas`
**API:** `/api/ferramentas/musicas`
**Arquivos:** `components/biblioteca-musicas.tsx`, `lib/musicas-db.ts`

### Funcionalidades

- Catálogo de músicas livre de direitos para uso em vídeos
- Filtro por tags
- Adicionar novas músicas (inspetor)
- Lista de todas as tags disponíveis

### Tabela `musicas`

```sql
id          UUID PRIMARY KEY
titulo      TEXT NOT NULL
artista     TEXT NOT NULL
url         TEXT NOT NULL
tags        TEXT[]          -- categorias/tags
criada_em   TIMESTAMPTZ
```

---

## 🏆 Sistema de Ranking e Níveis

### Níveis (baseado em entregas)

| Nível | Entregas necessárias |
|---|---|
| 1 (Bronze) | 0+ |
| 2 (Prata) | 10+ |
| 3 (Ouro) | 30+ |
| 4 (Diamante) | 60+ |

> `nivel` é `GENERATED ALWAYS` no banco — calculado automaticamente.

### Ranking

- Ordenado por: `reputacao DESC, entregues DESC, apelido ASC`
- Filtro: `perfil_completo = true OR entregues > 0`
- Página pública: `/ranking`

### Reputação

- Incrementa ao aprovar entrega
- Baseada nas avaliações (1-5 estrelas)
- Média: `nota` (NUMERIC(3,1))

---

## 📰 Sistema de Novidades

**Arquivo:** `lib/novidades-db.ts`, `lib/novidades.ts`
**Páginas:** Inspetor manage + exibição pública

### Funcionalidades

- Inspetor cria/edita/apaga novidades
- Toggle de publicação (publicado/rascunho)
- Exibição na dashboard (últimas 4 publicadas)

---

## 🎓 Onboarding e Guias

**Arquivo:** `lib/guia.ts`, `components/tutorial-drive.tsx`

### 10 roteiros de onboarding

1. `porta-voz` — Overview do porta-voz
2. `nova-pauta` — Como criar missão
3. `missao-candidato` — Acompanhar missão
4. `editor` — Overview do editor
5. `agenda` — Disponibilidade
6. `perfil-editor` — Perfil do editor
7. `contas` — Gestão de contas
8. `perfil-candidato` — Perfil do candidato
9. `panorama` — Panorama do inspetor
10. `inspetor` — Overview do inspetor

### Funcionamento

- Detecta rota atual via `guiaDaRota(window.location.pathname)`
- Verifica se já foi visto (localStorage com versão)
- Exibe passo-a-passo com tooltips
- Tutorial do Drive: modal com instruções de compartilhamento

---

## 🚢 Deploy e Infraestrutura

### Produção

- **Plataforma:** Vercel
- **Domínio:** oficinaamarela.com.br
- **Deploy:** `npx vercel --prod --yes`
- **Banco:** Supabase/Neon PostgreSQL
- **Storage:** Vercel Blob
- **Email:** Resend
- **Monitoring:** Sentry
- **Auth:** JWT via jose (HS256), cookie `confraria_sessao`

### Comandos

```bash
# Desenvolvimento local
npm run dev

# Build
npm run build

# Deploy produção
npx vercel --prod --yes

# Pull env vars (NÃO faz — valores sensíveis são mascarados)
npx vercel env pull

# Listar env vars
npx vercel env ls
```

### Migrations

Como valores sensíveis do Vercel não são acessíveis localmente, migrations são feitas via:
1. Criar endpoint temporário em `app/api/migrate-*/route.ts`
2. Deployar
3. Hit `GET /api/migrate-*`
4. Remover endpoint
5. Redeploy

---

## 🔑 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | String de conexão PostgreSQL (Supabase/Neon) |
| `AUTH_SECRET` | ✅ | Chave secreta para assinar JWT |
| `GOOGLE_CLIENT_ID` | ✅ | Client ID do Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ✅ | Client Secret do Google OAuth |
| `RESEND_API_KEY` | ✅ | API key do Resend (emails) |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Token do Vercel Blob (armazenamento) |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | DSN do Sentry (se vazio, SDK fica inerte) |
| `EMAIL_REMETENTE` | ❌ | Email remetente (padrão: `noreply@oficinaamarela.com.br`) |

> **Importante:** O `.env.local` NÃO vai pro Git (está no `.gitignore`). As variáveis de produção estão configuradas no painel do Vercel.

---

## 💻 Como Rodar Localmente

### Pré-requisitos

- Node.js 18+
- npm
- PostgreSQL local (ou usar o banco do Supabase/Neon remotamente)

### Passos

```bash
# 1. Clonar o repositório
git clone https://github.com/lunatecfra-cyber/oficina-amarela.git
cd oficina-amarela

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas variáveis (DATABASE_URL, AUTH_SECRET, etc.)

# 4. Rodar o schema SQL no banco
# Usar o Supabase SQL Editor ou:
psql $DATABASE_URL -f supabase/schema.sql

# 5. Rodar em desenvolvimento
npm run dev
```

### Dev Login

Em desenvolvimento, a rota `/api/auth/dev-login` permite login sem senha (bypass). O middleware detecta ambiente local e permite acesso livre.

---

## 🖥 Como Clonar e Configurar em Outro PC

### Opção 1: Via GitHub (recomendado)

```bash
# 1. Instalar Git (se não tiver)
# Download: https://git-scm.com/download/win

# 2. Clonar
git clone https://github.com/lunatecfra-cyber/oficina-amarela.git
cd oficina-amarela

# 3. Instalar Node.js (se não tiver)
# Download: https://nodejs.org

# 4. Instalar dependências
npm install

# 5. Configurar .env.local
# Criar o arquivo .env.local com as variáveis de ambiente:
# DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# RESEND_API_KEY, BLOB_READ_WRITE_TOKEN

# 6. Criar banco de dados local (opcional)
# Ou usar o DATABASE_URL de produção do Supabase/Neon

# 7. Rodar
npm run dev
```

### Opção 2: Deploy direto no Vercel do outro PC

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Fazer login
vercel login

# 3. Clonar o repo
git clone https://github.com/lunatecfra-cyber/oficina-amarela.git
cd oficina-amarela

# 4. Linkar ao projeto existente
vercel link

# 5. Configurar env vars no painel do Vercel
# https://vercel.com/lunatecfra-8222s-projects/oficina-amarela/settings/environment-variables

# 6. Deploy
npx vercel --prod --yes
```

### Variáveis que PRECISAM ser configuradas no novo PC

As variáveis sensíveis estão no painel do Vercel (não são acessíveis via CLI). Se precisar configurar localmente, você precisa obter:

1. **DATABASE_URL** — do painel do Supabase/Neon (ou Vercel env vars)
2. **AUTH_SECRET** — gerar uma nova: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **GOOGLE_CLIENT_ID** e **GOOGLE_CLIENT_SECRET** — do Google Cloud Console
4. **RESEND_API_KEY** — do painel do Resend
5. **BLOB_READ_WRITE_TOKEN** — do painel do Vercel

---

## 📐 Convenções de Código

### TypeScript

- **Sem `any`:** Usar tipos explícitos
- **Wrapper `sql`:** Não suporta generics — usar `as unknown as Type[]` (double cast)
- **Import mapping:** `@/lib/...`, `@/components/...`

### Nomes

- **Componentes:** PascalCase (`NovaPautaForm`, `ChatMissao`)
- **Arquivos de componente:** kebab-case (`nova-pauta-form.tsx`, `chat-missao.tsx`)
- **Funções:** camelCase (`criarPauta`, `despacharMissoes`)
- **Tipos:** PascalCase (`Pauta`, `StatusPauta`, `Editor`)
- **Constantes:** UPPER_SNAKE_CASE (`LIMITES`, `VAGAS`, `ROTULO_STATUS`)

### CSS

- Tailwind CSS v4
- Cores customizadas: `text-gold`, `text-gold-hi`, `bg-gold`, `bg-ink-2`, `border-line`
- Fonte display: `font-[family-name:var(--font-display)]` (Cinzel)
- Cards: `rounded-2xl`, gradientes dourados
- Classes utilitárias: `btn-gold`, `btn-ghost`, `field-input`

### Padrões

- Server Components por padrão
- `"use client"` apenas quando necessário (estado, efeitos, eventos)
- Sem `console.log` em produção
- Comentários em português brasileiro

---

## ✅ Funcionalidades Implementadas

### Core (MVP)
- [x] Sistema de autenticação (email + Google OAuth)
- [x] Seleção de papel (voz/editor)
- [x] Criação de missões (5 passos)
- [x] Fila de despacho automático (estilo Uber)
- [x] Aceite/recusa de ofertas
- [x] Entrega de vídeo
- [x] Aprovação/reedição pelo porta-voz
- [x] Chat por missão (com polling e auto-scroll)
- [x] Dashboard do porta-voz (minhas missões)
- [x] Dashboard do editor (fila, aceitar)
- [x] Perfil do editor (completo)
- [x] Perfil do candidato (completo)
- [x] Grade de disponibilidade (3×7)
- [x] Ranking público de editores

### Inspetor (Admin)
- [x] Panorama do sistema (estatísticas)
- [x] Gestão de fila (mover missões)
- [x] Gestão de contas (banir, desbanir, deletar)
- [x] Gestão de denúncias
- [x] Gestão de novidades
- [x] Notificações em massa (email)

### Funcionalidades Adicionais
- [x] Links do YouTube e Drive nas missões (ambos opcionais)
- [x] URLs clicáveis no chat
- [x] Chat auto-refresh (polling 5s, pausa quando aba oculta)
- [x] Ferramentas: 8 video editors externos
- [x] Biblioteca de músicas (com tags e filtros)
- [x] Banner de perfil incompleto
- [x] Onboarding interativo (10 guias)
- [x] Tutorial do Google Drive
- [x] Login via Google OAuth
- [x] Recuperação de senha
- [x] Upload e compressão de foto
- [x] Monitoramento de erros (Sentry)
- [x] Rate limiting (banco, não memória)
- [x] Presença de editores (polling, janela 3min)
- [x] Candidatos públicos por slug
- [x] Perfil público do candidato

---

## 🚧 Funcionalidades Pendentes/Futuras

- [ ] Recompensa de login diário (+10 XP)
- [ ] Sistema de progressão por níveis (10 níveis de XP)
- [ ] Nuvem/depósito de vídeos bruto na própria plataforma
- [ ] Webhooks para notificações em tempo real (substituir polling)
- [ ] App mobile (PWA)
- [ ] Sistema de pagamento/planos
- [ ] Analytics detalhado
- [ ] Exportação de relatórios

---

## 📞 Contato e Suporte

- **Repositório GitHub:** https://github.com/lunatecfra-cyber/oficina-amarela
- **Produção:** https://oficinaamarela.com.br
- **Painel Vercel:** https://vercel.com/lunatecfra-8222s-projects/oficina-amarela

---

> Documentação gerada automaticamente. Projeto construído com Next.js 16, React 19, TypeScript, Tailwind CSS v4, PostgreSQL (Supabase/Neon).
