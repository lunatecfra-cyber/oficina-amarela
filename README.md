# Oficina Amarela

> Plataforma colaborativa de produção e edição de vídeo para comunicação política, conectando candidatos/porta-vozes, editores parceiros e inspetores de qualidade.

---

## 📌 Sobre o Projeto

A **Oficina Amarela** é uma plataforma desenhada para acelerar e profissionalizar o fluxo de edição de vídeos curtos (Reels/Shorts/TikTok) e longos (YouTube) para campanhas e lideranças políticas. 

O sistema organiza a demanda em **missões de edição**, distribuídas de forma justa e inteligente para editores qualificados, com controle de qualidade em tempo real, proteção de conformidade eleitoral (TSE/CNPJ) e um sistema de **ranking eleitoral e constância com gamificação**.

---

## 👥 Papéis no Sistema

| Papel | Acesso | Principais Funcionalidades |
|---|---|---|
| **Porta-Voz (Candidato / Campanha)** | `/porta-voz` | • Criação de pautas/missões com briefing completo (tom, cores, fontes, referências)<br>• Upload de vídeos brutos (Cloudflare R2 / Drive / YouTube)<br>• Revisão e aprovação direta de entregas com nota e comentários<br>• Chat interno na missão e gestão do perfil eleitoral |
| **Editor de Vídeo** | `/editor` | • Fila de missões oferecidas sob demanda<br>• Mesa de trabalho ativa com controle de prazos<br>• Conquista de XP, reputação, níveis (Aprendiz ➔ Oficial ➔ Artífice ➔ Mestre-Artesão)<br>• Ranking eleitoral com metas semanais e proteção por bloqueios de constância<br>• Código de indicação de novos editores |
| **Inspetor (Administrador / Qualidade)** | `/inspetor` | • Panorama geral em tempo real de missões e editores<br>• Moderação de fila, denúncias e contas de usuários<br>• Emissão e revogação de convites exclusivos para porta-vozes<br>• Concessão de bloqueios de constância e auditoria de ações administrativas<br>• Disparo de avisos (broadcast) e publicação de novidades |

---

## ✨ Principais Funcionalidades

- **Fila Inteligente de Missões**: Distribuição automatizada de missões para editores disponíveis, sem disputas desordenadas.
- **Ranking Eleitoral 2026**:
  - Metas semanais dinâmicas de entregas aprovadas.
  - **Bloqueios de Constância (Shields)**: Protege a sequência do editor em semanas atípicas.
  - **Vitrine de Prêmios Coletivos**: Desbloqueio progressivo de recompensas conforme a comunidade de editores ativos cresce.
  - **Sorteio por Constância**: Elegibilidade automática para editores com 4+ semanas consecutivas de metas batidas.
- **Programa de Indicação de Editores**: Link personalizado por editor; gera reputação bônus quando o indicado tem 2 entregas aprovadas.
- **Convites Exclusivos de Porta-Voz**: Onboarding restrito com tokens criptografados e controle de expiração.
- **Chat Integrado por Missão**: Canal contextualizado entre porta-voz, editor e inspetor sem necessidade de WhatsApp.
- **Upload Direto em Nuvem**: URLs pré-assinadas com upload direto para o **Cloudflare R2**.
- **Notificações por E-mail**: Avisos automáticos em cada mudança de estado da missão via **Resend**.
- **Ferramentas e Aulas**: Biblioteca de trilhas sonoras livres de royalties e guias rápidos para editores e candidatos.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) (Supabase) gerenciado via driver nativo `postgres`
- **Autenticação**:
  - Google OAuth 2.0 (com fluxo pós-login para escolha de papel)
  - Autenticação tradicional com senhas hasheadas em `bcryptjs`
  - Sessões em cookies seguros assinados com `jose` (JWT)
- **Armazenamento de Objetos (Storage)**: [Cloudflare R2](https://www.cloudflare.com/products/r2/) via `@aws-sdk/client-s3`
- **E-mails Transacionais**: [Resend](https://resend.com/)
- **Observabilidade**: [Sentry](https://sentry.io/)

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js**: v20.x ou v22.x+
- **npm** ou **bun**
- Instância do **PostgreSQL** ou projeto no **Supabase**

### 1. Clonar o repositório
```bash
git clone git@github.com:lunatecfra-cyber/oficina-amarela.git
cd oficina-amarela
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto com base nas variáveis necessárias:

```env
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@host:5432/nome_banco

# Autenticação e Sessão
AUTH_SECRET=uma-chave-secreta-longa-e-aleatoria-com-pelo-menos-32-caracteres

# Google OAuth (Opcional em desenvolvimento)
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret

# E-mails (Resend - Opcional em desenvolvimento)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_REMETENTE="Oficina Amarela <contato@seudominio.com.br>"

# Cloudflare R2 / Storage (Opcional em desenvolvimento)
R2_ACCOUNT_ID=seu-account-id
R2_ACCESS_KEY_ID=seu-access-key-id
R2_SECRET_ACCESS_KEY=seu-secret-access-key
R2_BUCKET_NAME=oficina-amarela
R2_PUBLIC_URL=https://midia.seudominio.com.br

# Atalhos de desenvolvimento — desligados por padrão, recusados em produção
# ALLOW_DEV_AUTH_BYPASS=1   # login instantâneo em /dev, god mode, sessão fake
# ALLOW_DEMO_CONTENT=1      # missões e perfis de exemplo nas telas
# DATABASE_STUB=1           # roda sem banco: toda query devolve lista vazia
```

> As três variáveis acima só valem quando `NODE_ENV` é diferente de
> `production`, e mesmo assim precisam do valor exato `1`. Sem elas o
> aplicativo exige login de verdade, não mostra conteúdo de exemplo e falha
> alto se `DATABASE_URL` não estiver configurado — que é o comportamento
> esperado em qualquer ambiente publicado.

O `.env.local` fica em `apps/web/`.

Para o Worker da API em staging, PostgreSQL entra por Hyperdrive. Quando as
credenciais de **staging** existirem, crie o binding sem gravar a URL no Git:

```bash
cd apps/api
npx wrangler hyperdrive create oficina-amarela-staging \
  --env staging --binding HYPERDRIVE --update-config \
  --connection-string "$STAGING_DATABASE_URL"
```

O código usa `env.HYPERDRIVE.connectionString` no Worker e continua aceitando
`DATABASE_URL` no Next.js e nos testes locais. Não use a URL de produção nesta
etapa.

### 4. Executar o schema / migrações do banco
```bash
node --env-file=apps/web/.env.local scripts/migrar.mjs
node --env-file=apps/web/.env.local scripts/migrar-dados-anteriores.mjs
```

### 5. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```

## 🗂️ Estrutura do repositório

O projeto é um monorepo Turborepo:

```
oficina-amarela/
├── apps/web/       aplicação Next.js (app/, components/, lib/, public/)
├── scripts/        scripts operacionais (migração, backup, seed)
├── supabase/       schema canônico e migrações
├── docs/           documentação de arquitetura e migração
├── turbo.json
└── package.json    raiz do workspace
```

Os comandos da raiz (`npm run dev`, `build`, `test`, `typecheck`) passam pelo
Turborepo e alcançam todos os pacotes. `npm run lint` roda o Biome na raiz,
cobrindo o repositório inteiro.

### Testes que usam banco

Parte da suíte cobre invariantes que moram em índice do PostgreSQL —
concorrência de reserva de missão, fila de ofertas, caixa de saída de e-mail.
Sem `TEST_DATABASE_URL` esses testes são pulados.

```bash
docker run -d --rm --name oficina-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=oficina -p 5439:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" node scripts/migrar.mjs
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🧪 Testes e Validações

O projeto inclui testes de unidade para regras eleitorais, consistência, metas e convites:

```bash
# Executar suíte de testes
npm test

# Checagem estática de tipos
npx tsc --noEmit

# Build de produção
npm run build
```

---

## 📁 Estrutura de Diretórios

```
oficina-amarela/
├── app/                  # Rotas e páginas (Next.js App Router)
│   ├── api/              # Endpoints HTTP REST (autenticação, missões, ranking, admin)
│   ├── editor/           # Painel e telas do editor de vídeo
│   ├── porta-voz/        # Painel, nova pauta e tela de missão do porta-voz
│   ├── inspetor/         # Painel administrativo, auditoria, denúncias e panorama
│   ├── ranking/          # Visualização pública do ranking eleitoral
│   └── ...
├── components/           # Componentes visuais e interativos (React)
├── lib/                  # Camada de domínio, regras de negócio e acesso ao banco (SQL)
│   ├── accounts.ts       # Gestão de contas, autenticação e slots
│   ├── missions-db.ts    # Transições de estado e consultas de pautas
│   ├── electoral-ranking-db.ts # Ranking eleitoral, constância e bloqueios
│   ├── profile-db.ts     # Perfis e histórico de editores
│   ├── session.ts        # Sessões JWT seguras
│   └── ...
├── scripts/              # Scripts utilitários e migrações de banco
├── supabase/             # Schema canônico e migrações SQL
└── public/               # Ativos estáticos, fontes e imagens
```

---

## 📄 Convenções e Boas Práticas

- **Nomenclatura da Codebase**: Código, tipos, funções e nomes de variáveis padronizados em inglês internamente.
- **Interface e Mensagens**: Textos públicos, rótulos de tela, mensagens de erro e e-mails permanecem integralmente em **Português do Brasil (PT-BR)**.
- **Commits**: Mensagens de commit descritivas no padrão Conventional Commits em **Português do Brasil (PT-BR)**.

---

## 📜 Licença

Propriedade privada da **Oficina Amarela / Pacto da Concórdia**. Todos os direitos reservados.
