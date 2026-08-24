# Fluxo, Backend e Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testar o fluxo da Oficina Amarela e corrigir falhas pequenas de segurança, transições de missão, navegação por papel e layout compartilhado.

**Architecture:** Preservar Next.js App Router, `proxy.ts`, SQL via `postgres.js` e o padrão client/server existente. A primeira rodada será pequena: retirar superfície dev da produção, centralizar regras puras testáveis e manter páginas compartilhadas conscientes do papel da sessão.

**Tech Stack:** Next.js 16.3.0, React 19, TypeScript, PostgreSQL via `postgres.js`, Node 24 para scripts de regressão.

**Spec:** `docs/SPEC.md` e `docs/PLANO.md`.

## Global Constraints

- Não fazer deploy, migração ou alteração em serviço externo.
- Não remover o stub vazio de `lib/db.ts`.
- Não importar módulos server-only em Client Components.
- Testar cada correção antes de seguir para a próxima.
- Validar com lint, TypeScript, build e viewport mobile quando a rodada terminar.

---

### Task 1: Fechar a superfície de desenvolvimento em produção

**Files:**
- Modify: `app/dev/page.tsx`
- Modify: `proxy.ts`
- Test: `scripts/testar-superficie-dev.mjs`

**Interfaces:**
- Consumes: `process.env.NODE_ENV`, `process.env.VERCEL` e a função `proxy`.
- Produces: `/dev` redireciona ou responde 404 fora do desenvolvimento; atalhos de dev continuam disponíveis localmente.

- [ ] **Step 1: Write the failing test**

Criar um script que leia o contrato da rota e exija uma guarda explícita para produção, além de manter `dev-login` bloqueado quando `VERCEL` estiver definido.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/testar-superficie-dev.mjs`
Expected: FAIL porque `/dev` não possui guarda própria.

- [ ] **Step 3: Write minimal implementation**

Adicionar guarda server-side em `app/dev/page.tsx` que chame `notFound()` quando `process.env.NODE_ENV !== "development"` ou `process.env.VERCEL` estiver definido. Manter a rota fora do fluxo normal de usuários.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/testar-superficie-dev.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Não criar commit automático neste workspace sem solicitação do dono.

### Task 2: Cobrir o contrato de transições de missão

**Files:**
- Create: `lib/transicoes-pauta.ts`
- Modify: `app/api/pautas/[id]/route.ts`
- Test: `scripts/testar-transicoes-pauta.mjs`

**Interfaces:**
- Consumes: papel da sessão, ação recebida e status atual.
- Produces: `podeExecutarAcao(status, papel, acao): boolean`, usado antes de chamar SQL.

- [ ] **Step 1: Write the failing test**

Cobrir que editor pode entregar apenas `reservada`/`reedicao`, inspetor pode revisar apenas `em_revisao`, porta-voz pode aceitar apenas `aprovada` e ações desconhecidas são recusadas.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/testar-transicoes-pauta.mjs`
Expected: FAIL porque a função ainda não existe.

- [ ] **Step 3: Write minimal implementation**

Implementar a tabela pura de permissões em `lib/transicoes-pauta.ts` e usá-la na rota antes das funções de banco, preservando as verificações de ownership já existentes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/testar-transicoes-pauta.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Não criar commit automático neste workspace sem solicitação do dono.

### Task 3: Revisar navegação compartilhada e layout

**Files:**
- Modify: `components/app-header.tsx`
- Modify: `components/app-header-porta-voz.tsx`
- Modify: `app/parceiros/page.tsx`
- Test: `scripts/testar-navegacao-parceiros.mjs`

**Interfaces:**
- Consumes: `SessaoUsuario.papel`.
- Produces: cabeçalho coerente para `voz`, `editor` e `admin`, com links que não mudam o papel.

- [ ] **Step 1: Write the failing test**

Manter regressão para os três papéis e adicionar verificação de que o link de logo de admin não aponta para a fila do editor.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/testar-navegacao-parceiros.mjs`
Expected: FAIL se algum cabeçalho compartilhado voltar a apontar admin para `/editor`.

- [ ] **Step 3: Write minimal implementation**

Centralizar a escolha do cabeçalho por papel e manter alvos de navegação separados.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/testar-navegacao-parceiros.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Não criar commit automático neste workspace sem solicitação do dono.

### Task 4: Verificação final do fluxo

**Files:**
- Modify: `docs/ROADMAP-COMPLETO.md`

**Interfaces:**
- Consumes: resultados das tarefas anteriores e testes locais.
- Produces: registro objetivo do que foi verificado e do que continua pendente.

- [ ] **Step 1: Testar rotas públicas e protegidas**

Usar o servidor local e confirmar `/`, `/login`, `/parceiros`, `/dev`, `/api/vagas` e uma rota protegida.

- [ ] **Step 2: Testar qualidade estática**

Rodar `npm run lint`, `npx tsc --noEmit` e `npm run build`.

- [ ] **Step 3: Testar mobile**

Validar `/`, `/parceiros` e a área de papel em viewport 390x844.

- [ ] **Step 4: Atualizar documentação**

Registrar apenas correções realmente verificadas; manter Google Drive, DNS, Resend, backups e CI como pendências externas quando não houver credenciais/autorização.
