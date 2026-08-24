<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Como trabalhar neste projeto

Duas regras, destiladas do [obra/superpowers](https://github.com/obra/superpowers)
(MIT) e mantidas porque foram justamente elas que acharam os bugs reais aqui.
A parte de TDD daquele pacote ficou de fora: o projeto não tem infra de teste,
e a lei dele ("nenhum código sem um teste falhando antes") pararia tudo.

## 1. Não diga que terminou sem verificar na hora

Antes de afirmar que algo está pronto:

1. Escolha o comando que **prova** a afirmação.
2. Rode **agora** — não vale resultado de antes.
3. Leia a saída inteira, não só o final.
4. Se a saída não sustenta a afirmação, diga o estado real.

**Não contam como prova:**
- Lint passando (não prova que compila).
- `tsc` passando (não prova que funciona na tela).
- O código ter sido alterado (não prova que corrigiu).
- Relatório de outro agente (verifique você mesmo).

**Palavras proibidas antes de verificar:** "deve", "provavelmente", "parece
que". Ou você rodou e leu, ou não sabe.

> Foi assim que apareceram, nesta ordem: os contadores do perfil que perdiam
> uma missão; a `headline` saindo como JSON cru na tela; a landing inteira
> dando 404 em `/entrar`; a missão duplicada na fila do editor.

## 2. Causa-raiz antes do remendo

**Nenhuma correção antes de entender a origem.**

1. **Investigar** — reproduza, leia o erro inteiro, siga o dado de trás pra
   frente até a fonte. Não pare no sintoma.
2. **Comparar** — ache no próprio código um caso que funciona e veja a
   diferença exata.
3. **Testar uma hipótese por vez** — uma mudança só. Duas ao mesmo tempo e
   você não sabe qual resolveu.
4. **Corrigir** na origem, e provar (regra 1).

**Três tentativas falhas = pare.** O problema não é a hipótese, é a
arquitetura. Levante a cabeça e questione o desenho.

> O `sql.json()` gravando numa coluna `TEXT` só apareceu porque a busca foi
> até a origem. Remendar a tela teria escondido o mesmo bug no formulário de
> edição, onde nenhum chip marcava.

## Vocabulário

Na tela é **missão**. No código é `pauta` (tabela `pautas`, `lib/pautas.ts`,
rota `/api/pautas`). Ver `docs/PLANO.md` pra história dessa decisão.

## 3. Produção, beta e pacotes de atualização (REGRA DO DONO)

- **Este workspace é área de desenvolvimento (beta).** O que roda aqui é
  trabalho em andamento, não lançamento.
- **Produção (`oficinaamarela.com.br`, banco Neon) é intocada por padrão.**
  Deploys são MANUAIS (`vercel --prod`) — nada sobe sozinho, e não sobe nada
  sem o dono aprovar o pacote primeiro.
- **O próximo lançamento é um PACOTE DE ATUALIZAÇÃO** — um conjunto completo
  e testado de mudanças (ex.: chat + denúncias + migrações), nunca peças
  soltas aos pedaços.
- **Migração de banco ANTES do deploy, sempre.** Toda tabela/coluna nova no
  `supabase/schema.sql` tem script em `scripts/` — rodar no Neon antes de
  publicar, senão a tela quebra em produção (o `banido` quase quebrou assim
  uma vez; `mensagens`/`denuncias` são o caso atual).
- **Papel viaja no cookie (30 dias).** Promover/degradar conta só faz
  efeito quando a pessoa re-loga. Não é bug — é desenho. Ao mudar papel de
  alguém, avisar pra sair e entrar.

## 3. Modo Caveman

Seja extremamente conciso, direto e curto nas respostas. Sem introduções longas ou "blá-blá-blá". Use tópicos rápidos.

## 4. Papéis dos Agentes

- **Antigravity (Eu):** Sou o "operário". Faço código rápido, pontual e direto (assento o tijolo). Não tomo decisões de arquitetura.
- **ZCode:** É o "arquiteto/consultor principal". Ele define a estrutura, atualizações complexas e cria os planos.
- **Claude:** Operário secundário/apoio.
- Sempre respeitar a ponte (`PONTE_CLAUDE.md`) e os planos do ZCode (`.zcode/plans`).

## 5. Design e proporção

Antes de dizer que uma tela está pronta, meça em **390px com toque emulado**.
As regras e o comando de medição estão em [`docs/DESIGN.md`](docs/DESIGN.md).

O que mais aparece, e já apareceu aqui:

- **Campo com menos de 16px** faz o iPhone dar zoom sozinho ao focar.
- **Alvo com menos de 44px de altura** o dedo erra. Link dentro de frase e
  checkbox nascem abaixo disso.
- **Fonte do Google no build** deixa o CI vermelho quando o Google demora. As
  fontes deste projeto moram em `public/fontes/`.

---

# Contexto Completo do Projeto

## Visão Geral

**Oficina Amarela** — plataforma que conecta candidatos políticos (porta-vozes) a editores de vídeo. O candidato cria uma "missão" com o briefing, a plataforma despacha pro editor, o editor faz o corte e entrega, o candidato revisa e aprova.

- **Produção:** https://oficinaamarela.com.br
- **GitHub:** https://github.com/lunatecfra-cyber/oficina-amarela
- **Vercel:** lunatecfra-8222s-projects/oficina-amarela
- **Banco:** Supabase/Neon PostgreSQL (acessado via Vercel env vars)

## Stack

| Tecnologia | Versão | Importante |
|---|---|---|
| Next.js | **16.3.0 App Router** | APIs diferentes do treino — ler `node_modules/next/dist/docs/` |
| React | 19 | Server Components por padrão |
| TypeScript | 5 | Sem `any` |
| Tailwind CSS | **v4** | Sintaxe diferente do v3 |
| PostgreSQL | Supabase/Neon | `prepare: false` obrigatório (pooler) |
| postgres.js | ^3.4.9 | **Sem ORM** — SQL puro via tagged template |
| jose | ^6.2.7 | JWT HS256, cookie `confraria_sessao` |
| bcryptjs | ^3.0.3 | Timing-constant |
| Resend | ^6.18.1 | E-mails transacionais |
| @vercel/blob | ^2.8.0 | Armazenamento de arquivos |

## Papéis

| Papel | DB value | Rotas |
|---|---|---|
| Porta-voz (candidato) | `voz` | `/porta-voz/*`, `/perfil/*`, `/ranking/*`, `/aulas/*`, `/ferramentas/*` |
| Editor | `editor` | `/editor/*`, `/perfil/*`, `/agenda/*`, `/ranking/*`, `/aulas/*`, `/ferramentas/*` |
| Inspetor (admin) | `admin` | Todas as rotas |

## Arquitetura — Padrão Dupla

Cada domínio tem **dois módulos**:
1. **Client-safe** (ex: `lib/pautas.ts`) — Tipos, constantes, dados demo, funções puras. Importável por `"use client"`.
2. **Server-only** (ex: `lib/pautas-db.ts`) — Queries SQL reais. **NUNCA** importar no client.

## Regras Críticas de Código

### `sql` wrapper NÃO suporta generics

```typescript
// ❌ NÃO funciona — o wrapper não passa generics pro postgres.js
const rows = await sql<MeuTipo>`SELECT * FROM tabela`;

// ✅ Use double cast
const rows = (await sql`SELECT * FROM tabela`) as unknown as MeuTipo[];
```

### `prepare: false` no postgres.js

Obrigatório com o Supabase pooler em modo "transaction". Já está configurado em `lib/db.ts`.

### Wrapper `sql` em `lib/db.ts`

```typescript
import { sql } from "@/lib/db";           // tagged template para queries
sql.json(dados);                           // para colunas JSONB
```

Conexão lazy — só conecta na primeira query. Permite `npm run build` sem `DATABASE_URL`.

### Middleware = `proxy.ts` (NÃO `middleware.ts`)

Em Next 16, `middleware.ts` está deprecated com warning. O middleware deste projeto é `proxy.ts`.

### Valores sensíveis do Vercel

`vercel env pull` mascara valores sensíveis como `[SENSITIVE]`. Migrations são feitas via endpoint temporário:
1. Criar `app/api/migrate-xyz/route.ts`
2. Deployar, hit GET, verificar
3. Remover endpoint, redeploy

### Comentários em português

Todo comentário de código em PT-BR. Commit messages em PT-BR.

## Estrutura de Arquivos

```
app/
  api/
    admin/          # Inspetor: avisar, denuncias, fila, novidades, pautas, usuarios
    auth/           # cadastro, dev-login, google(+callback+registrar), login, logout, recuperar, redefinir-senha, sessao
    conta/          # conta, conta/senha
    editor/         # disponibilidade, fila/proxima, perfil
    ferramentas/    # musicas
    pautas/         # pautas (POST criar), pautas/[id] (GET/PUT ações)
    perfil/         # perfil
    porta-voz/      # perfil
    vagas/          # vagas disponíveis
  aulas/           # Página de aulas
  candidato/[slug]/ # Perfil público
  criar-conta/     # Registro
  dev/             # Debug
  editor/          # Área editor (dashboard, criar-perfil)
  escolher-papel/  # Seleção voz/editor
  ferramentas/     # Ferramentas (video editors, músicas)
  inspetor/        # Área inspetor (dashboard, panorama, contas, denuncias, novidades)
  login/           # Login
  parceiros/       # Parceiros
  porta-voz/       # Área porta-voz (dashboard, criar-perfil, nova-pauta, missao/[id], perfil)
  perfil/          # Perfil editor (ver, editar)
  ranking/         # Ranking público

components/
  banner-perfil-incompleto.tsx
  biblioteca-musicas.tsx
  chat-missao.tsx           # Chat: polling 5s, pause oculto, auto-scroll, URLs clicáveis
  escolher-papel-form.tsx
  lista-ferramentas.tsx    # 8 video editors
  mesa-agora.tsx           # Fila de missões do editor
  missao-em-maos.tsx        # Card de missão aceita
  nav-editor.tsx
  nova-pauta-form.tsx       # Formulário 5 passos (Drive + YouTube opcionais, pelo menos 1)
  oferta-missao.tsx         # Card de oferta (aceitar/recusar)
  painel-contas.tsx         # Gestão de contas (inspetor)
  painel-panorama.tsx       # Panorama (inspetor)
  tutorial-drive.tsx

lib/
  agenda.ts                 # Client-safe: TrabalhoEmMaos, grade disponibilidade
  candidatos.ts             # Client-safe: Candidato, dados demo, cidades BR
  cidades-br.ts             # 5.570 municípios (IBGE)
  compressir-foto.ts        # Client: compressão foto (canvas→WebP)
  contas.ts                 # Server: cadastro, auth, bcrypt, rate limiting, Google
  db.ts                     # Conexão lazy PostgreSQL, wrapper sql
  denuncias-db.ts           # Server: denúncias
  email.ts                  # Server: Resend (fire-and-forget)
  fila-db.ts               # Server: dispatch estilo Uber, ofertas
  guia.ts                   # Client: 10 roteiros de onboarding
  ip.ts                     # Server: extração IP
  limites.ts                # Limites de campos, vagas, foto
  musicas-db.ts             # Server: CRUD músicas
  novidades-db.ts           # Server: CRUD novidades
  novidades.ts              # Client: dados demo novidades
  oauth-google.ts           # Google OAuth helpers
  painel-db.ts              # Server: panorama (resumo, fila, em voo)
  perfil-db.ts              # Server: perfil editor (CRUD, ranking)
  perfil.ts                 # Client: tipos, softwares, estilos, níveis
  pautas-db.ts             # Server: CRUD missões, ciclo completo
  pautas.ts                 # Client: tipos, rótulos, etapas, demo
  candidatos-db.ts          # Server: CRUD candidatos
  sessao.ts                 # Edge: JWT, tokens recuperação, OAuth state
  sessao-servidor.ts        # Server: lerSessao, exigirSessao
  sentry-comum.ts           # Sentry config compartilhado
  tutoriais.ts             # Client: URLs tutoriais, util embed
  validators.ts             # Client: pareceLink, pareceLinkDrive, pareceLinkYoutube

proxy.ts                    # Middleware auth (proxy.ts, não middleware.ts!)
supabase/schema.sql         # Schema completo do banco
```

## Banco de Dados — Tabelas Principais

| Tabela | Descrição |
|---|---|
| `users` | Usuários (30+ colunas: papel, perfil, stats, redes sociais, disponibilidade JSONB) |
| `pautas` | Missões (status: disponivel→oferecida→reservada→em_revisao→aprovada→finalizada) |
| `ofertas` | Ofertas de missão (dispatch, expira 5 min) |
| `mensagens` | Chat por missão |
| `avaliacoes` | Avaliações 1-5 estrelas |
| `denuncias` | Denúncias |
| `musicas` | Biblioteca de músicas |
| `portfolio` | Portfolio de editores |
| `conquistas` | Conquistas/badges |
| `tentativas_login` | Rate limiting |

### Detalhe: colunas de links na `pautas`

- `drive_link TEXT` — link do Drive (opcional)
- `youtube_link TEXT` — link do YouTube (opcional)
- Regra: pelo menos um dos dois preenchido ao criar missão

### Detalhe: `nivel` é GENERATED ALWAYS

```sql
nivel INT GENERATED ALWAYS AS (
  CASE WHEN entregues >= 60 THEN 4
       WHEN entregues >= 30 THEN 3
       WHEN entregues >= 10 THEN 2
       ELSE 1 END
) STORED
```

## Fluxo de Missão

```
CRIADA (disponivel)
  → porta-voz preenche briefing (5 passos, POST /api/pautas)
DESPACHADA (oferecida)
  → fila-db.ts:despacharMissoes() encontra editor, cria oferta
ACEITA (reservada)
  → editor aceita (PUT /api/editor/fila/proxima)
ENTREGUE (em_revisao)
  → editor envia link (PUT /api/pautas/[id])
APROVADA (aprovada/finalizada) OU REEDIÇÃO (reedicao)
  → porta-voz aprova ou pede ajustes
```

## Fila (Dispatch Estilo Uber)

- `lib/fila-db.ts:despacharMissoes()` — até 20 missões por chamada
- Seleção: entregas pro mesmo porta-voz → total entregues DESC → espera ASC
- Janela de presença: 3 minutos (`ultimo_visto_em`)
- Expiração: 5 minutos por oferta
- Concorrência: índices parciais únicos no banco

## Chat

- Polling 5s via `setInterval`
- Pausa quando aba oculta (`document.visibilityState`)
- Auto-scroll via `scrollIntoView`
- URLs clicáveis: `https?://` vira `<a target="_blank">`
- Controle acesso: dono + editor + admin

## Visual / Design

- Tema dourado: `text-gold`, `text-gold-hi`, gradientes ouro
- Cards: `rounded-2xl`
- Fonte display: `font-[family-name:var(--font-display)]` (Cinzel)
- Classes: `btn-gold`, `btn-ghost`, `field-input`
- Media query mobile: verificar em 390px

## Deploy

```bash
npx vercel --prod --yes    # Deploy produção
npm run dev                # Desenvolvimento local
npm run build              # Build (TypeScript check)
```

## Documentação

- **DOCUMENTACAO-COMPLETA.md** — documentação extensa de todo o projeto (26 seções)
- Ler esse arquivo pra entender qualquer parte do sistema

## Variáveis de Ambiente

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL (Supabase/Neon) |
| `AUTH_SECRET` | ✅ | Chave JWT |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth |
| `RESEND_API_KEY` | ✅ | Emails |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | Sentry (vazio = inerte) |
| `EMAIL_REMETENTE` | ❌ | Email remetente |

## Estado Atual das Features

### ✅ Implementado
- Auth completo (email + Google OAuth + recuperação senha)
- Missões (criar, dispatch, aceitar, entregar, aprovar, reeditar)
- Chat com polling, auto-scroll, URLs clicáveis
- Drive + YouTube links (ambos opcionais, pelo menos 1 obrigatório)
- 8 video editors na página de ferramentas
- Biblioteca de músicas com tags
- Ranking e níveis (auto-calculado pelo banco)
- Onboarding interativo (10 guias)
- Panorama, gestão de contas, denúncias, novidades (inspetor)
- Rate limiting no banco, ban + kill session
- Presença de editores (janela 3 min)
- Compressão de foto client-side
- Banner de perfil incompleto

### 🚧 Pendente/Futuro
- Recompensa de login diário (+10 XP)
- Sistema de 10 níveis de XP
- Nuvem/depósito de vídeos na plataforma
- Webhooks tempo real (substituir polling)

## Uso econômico do agente

- Preferir inspeções focadas e comandos paralelos quando forem independentes.
- Fazer mudanças pequenas, sem deploy, migração ou alteração de serviço externo sem aprovação explícita do dono.
- Rodar primeiro os testes mais baratos e só depois lint, TypeScript e build quando a mudança justificar.
- Não acessar caixas de e-mail ou outras contas externas sem conexão e autorização específicas.

### Ferramentas preferenciais

- Priorizar `superpowers` para organizar, implementar e verificar tarefas.
- Priorizar browser/Playwright para testar fluxos reais e responsividade.
- Usar as integrações de Supabase, Vercel e Sites somente quando a tarefa exigir backend, infraestrutura ou publicação.
- Usar skills de design apenas para mudanças visuais concretas, evitando carregar contexto de ferramentas que não serão usadas.
- Não instalar ou invocar skills/plugins da lista de referências sem uma necessidade específica e autorização compatível.
- Em tarefas de código, aplicar `caveman` para respostas enxutas e `ponytail` para evitar abstrações, dependências e código desnecessários; suspender ambos quando a compressão puder causar ambiguidade.
