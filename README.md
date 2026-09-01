# Oficina Amarela

Plataforma de produção e edição de vídeo para comunicação política. Liga
porta-vozes que precisam de vídeo editado a editores parceiros, com inspetores
cuidando da qualidade.

O trabalho é organizado em missões: o porta-voz abre uma com o briefing, a
missão entra numa fila, um editor pega, entrega, e o porta-voz aprova. Em volta
disso ficam o controle de qualidade, a conformidade eleitoral (TSE/CNPJ) e o
ranking de constância dos editores.

## Papéis

| Papel | Acesso | Principais Funcionalidades |
|---|---|---|
| **Porta-Voz (Candidato / Campanha)** | `/porta-voz` | • Criação de pautas/missões com briefing completo (tom, cores, fontes, referências)<br>• Upload de vídeos brutos (Cloudflare R2 / Drive / YouTube)<br>• Revisão e aprovação direta de entregas com nota e comentários<br>• Chat interno na missão e gestão do perfil eleitoral |
| **Editor de Vídeo** | `/editor` | • Fila de missões oferecidas sob demanda<br>• Mesa de trabalho ativa com controle de prazos<br>• Conquista de XP, reputação, níveis (Aprendiz ➔ Oficial ➔ Artífice ➔ Mestre-Artesão)<br>• Ranking eleitoral com metas semanais e proteção por bloqueios de constância<br>• Código de indicação de novos editores |
| **Inspetor (Administrador / Qualidade)** | `/inspetor` | • Panorama geral em tempo real de missões e editores<br>• Moderação de fila, denúncias e contas de usuários<br>• Emissão e revogação de convites exclusivos para porta-vozes<br>• Concessão de bloqueios de constância e auditoria de ações administrativas<br>• Disparo de avisos (broadcast) e publicação de novidades |

## O que o sistema faz

A fila de missões distribui trabalho para os editores disponíveis, um de cada
vez, em vez de deixar todo mundo disputar a mesma pauta.

O ranking eleitoral de 2026 cobra uma meta semanal de entregas aprovadas, que
diminui quando a semana é encurtada pelo fim do ciclo. Um editor tem bloqueios
de constância para cobrir uma semana que não deu, e quem fecha quatro semanas
seguidas entra no sorteio. A vitrine de prêmios abre por faixa: 10 editores
ativos liberam o primeiro, 20 o segundo, e assim por diante. Editor que indica
outro ganha reputação quando o indicado tem duas entregas aprovadas.

Porta-voz só entra por convite, com token guardado em hash e prazo de validade.
Dentro da missão há um chat entre porta-voz, editor e inspetor, então a conversa
não precisa migrar para o WhatsApp. O vídeo bruto sobe direto para o Cloudflare
R2 por URL pré-assinada, e cada mudança de estado da missão dispara um e-mail
pelo Resend. Editores e candidatos também têm uma biblioteca de trilhas livres
de royalties e algumas aulas curtas.

## Tecnologias

Monorepo Turborepo, com Biome fazendo lint e formatação.

- **Web**: [Next.js 16](https://nextjs.org/) (App Router, React 19) em
  [TypeScript](https://www.typescriptlang.org/), estilizado com
  [Tailwind CSS v4](https://tailwindcss.com/) e publicado como Worker da
  Cloudflare por `vinext` e `@vinext/cloudflare`.
- **API**: [Hono](https://hono.dev/) num Worker separado. O web chega nele por
  Service Binding, sem sair para a internet. Em desenvolvimento e nos testes a
  mesma aplicação roda em processo, então a troca entre os dois é uma
  atribuição.
- **Banco**: [Cloudflare D1](https://developers.cloudflare.com/d1/) quando o
  binding `DB` existe, e [PostgreSQL](https://www.postgresql.org/) (Supabase)
  pelo driver `postgres` quando não existe. A escolha vale para o conjunto
  inteiro de repositórios, nunca fatia a fatia. Os testes de D1 rodam em
  `miniflare`.
- **Coordenação e trabalho de fundo**: um Durable Object (`MissionCoordinator`)
  resolve a disputa de dois editores pela mesma missão. Uma Cloudflare Queue
  com fila de descarte e um Cron de um minuto cuidam da manutenção e drenam a
  caixa de saída de e-mail.
- **Autenticação**: Google OAuth 2.0, com escolha de papel depois do login;
  senha com hash em `bcryptjs`; sessão em cookie assinado com `jose` (JWT).
- **Arquivos**: [Cloudflare R2](https://www.cloudflare.com/products/r2/) por URL
  pré-assinada, via `@aws-sdk/client-s3`.
- **E-mail**: [Resend](https://resend.com/), atrás de uma caixa de saída no
  banco — enfileirar é uma escrita, e não depende do provedor estar de pé.
- **Observabilidade**: [Sentry](https://sentry.io/).

## Como rodar localmente

### Pré-requisitos
- Node.js v20.x ou v22.x+
- npm ou bun
- Um banco: PostgreSQL (ou projeto no Supabase), ou o D1 local que o wrangler
  cria na primeira aplicação de schema. Para só abrir as telas, nenhum dos dois
  é necessário: `DATABASE_STUB=1` faz toda consulta devolver lista vazia.

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

No PostgreSQL:

```bash
node --env-file=apps/web/.env.local scripts/migrar.mjs
node --env-file=apps/web/.env.local scripts/migrar-dados-anteriores.mjs
```

No D1 (`local`, `staging` ou `production`):

```bash
node scripts/aplicar-schema-d1.mjs local
```

### 5. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```

## Estrutura do repositório

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

## Convenções

Identificador é em inglês: nome de variável, função, tipo, classe de CSS e
coluna de banco. Texto que alguém lê é em português: rótulo de tela, mensagem
de erro, e-mail e mensagem de commit, esta última no padrão Conventional
Commits.

## Licença

Propriedade privada da Oficina Amarela / Pacto da Concórdia. Todos os direitos reservados.
