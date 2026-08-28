# Sistema de Gamificacao por Eventos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e exibir desafios diarios concluidos por eventos reais, sem pontuacao duplicada.

**Architecture:** Uma tabela de regras define os desafios e uma tabela de eventos usa uma chave unica por usuario, regra e referencia. Rotas de autenticacao e transicao de missao publicam eventos; a tela consulta o estado agregado.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL/Supabase, `postgres` tagged SQL.

**Spec:** `docs/superpowers/specs/2026-08-27-gamificacao-regras-design.md`

## Global Constraints

- Regras concluídas somente por eventos validos do servidor.
- Eventos e XP devem ser idempotentes.
- Produção não pode depender de fallback local.
- Não criar dependência nova.

### Task 1: Persistência e motor

**Files:**
- Create: `supabase/migrations/20260827_add_gamification_events.sql`
- Create: `lib/gamificacao-db.ts`

- [ ] Criar tabelas de regras e eventos com índices únicos.
- [ ] Implementar registro idempotente e leitura do estado diário.
- [ ] Testar lint e TypeScript.

### Task 2: Eventos do fluxo

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/cadastro/route.ts`
- Modify: `app/api/auth/google/registrar/route.ts`
- Modify: `app/api/pautas/[id]/route.ts`

- [ ] Registrar entrada após autenticação concluída.
- [ ] Registrar entrega somente após transição bem-sucedida.
- [ ] Não deixar falha de gamificação desfazer a ação principal.

### Task 3: Estado visual

**Files:**
- Modify: `app/editor/page.tsx`
- Modify: `components/desafios-dia.tsx`

- [ ] Passar estado real para a área de desafios.
- [ ] Remover conclusão manual dos desafios baseados em evento.
- [ ] Exibir progresso sem prometer XP que não foi registrado.

### Task 4: Verificação

- [ ] Repetir login e entrega e confirmar que não duplica evento.
- [ ] Rodar lint, TypeScript e build.
