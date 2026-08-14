# Roadmap — Sistema fluido de ponta a ponta

> Lista completa do que falta pra Oficina Amarela ficar redonda.
> Prioridades: 🔴 trava produto · 🟡 importa em escala · 🟢 polimento
> "verificar" = suspeito, não confirmei contra o código

## 🌐 Domínio, DNS & Infra

- 🔴 [ ] `www` verificar na Vercel (cache DNS deles; auto-resolve) → depois redirect `www → apex`
- 🔴 [ ] Resend validar domínio (pending) → setar `EMAIL_REMETENTE`
- 🟡 [ ] DMARC hoje `p=none` — após e-mail estável, subir pra `p=quarantine` e depois `p=reject` (antium spam)
- 🟡 [ ] Decidir: domínio só ENVIA e-mail (sem MX no apex) ou também RECEBE (precisa MX + caixa)
- 🟡 [ ] Monitor de uptime (UptimeRobot/BetterStack grátis) — site cai e ninguém sabe hoje
- 🟡 [ ] Backup do banco: Neon Free não tem PITR — `pg_dump` agendado (GitHub Action semanal) pro repositório privado
- 🟡 [ ] Renovação do domínio 02/08/2027 — evento no calendário agora
- 🟡 [ ] Alerta de segurança pendente na conta registro.br (vi na UI) — resolver
- 🟢 [ ] Analytics de tráfego (Vercel Analytics ou Plausible) — hoje cego sobre visitantes
- 🟢 [ ] Vercel Hobby → Pro no dia que monetizar (obrigatório, não opcional)

## 🔐 Segurança & LGPD

- 🔴 [ ] Sentry ativo (`NEXT_PUBLIC_SENTRY_DSN`) — produção hoje é cega
- 🟡 [ ] CSP está Report-Only — coletar relatórios, corrigir violações, promover a enforced
- 🟡 [ ] 2FA pro inspetor (conta admin única = ponto único de falha)
- 🟡 [ ] Log de auditoria do inspetor: quem baniu quem, quando (hoje só existe motivo, sem histórico de ações)
- 🟡 [ ] Rate limit nas demais rotas de escrita (cadastro tem; APIs de pauta/conta — verificar)
- 🟡 [ ] Headers de segurança (HSTS, X-Content-Type-Options, Referrer-Policy) — verificar next.config
- 🟢 [ ] Checklist LGPD documentado (apagar conta já existe; inventário de dados + retenção)
- 🟢 [ ] Backup cifrado das variáveis de ambiente (perder AUTH_SECRET = derrubar todas as sessões)

## ⚙️ Back-end & API

- 🔴 [ ] **Testes automatizados — ZERO hoje.** Começar por: vitest unit em `lib/contas`, `lib/sessao`, `lib/admin-usuarios`; depois rotas API
- 🔴 [ ] CI no GitHub Actions: lint + tsc + build a cada push (hoje nada roda automático)
- 🟡 [ ] Validação de entrada com zod nos bodies (hoje é checagem manual espalhada)
- 🟡 [ ] `/api/health` que pinga o Neon (uptime + deploy smoke test)
- 🟡 [ ] Job de expiração: ofertas vencidas e `reservada_ate` passadas voltam pra fila sozinhas (verificar se já roda on-demand)
- 🟡 [ ] Limpeza da tabela `tentativas_login` (cresce sem coleta?)
- 🟡 [ ] Índice `pg_trgm` GIN pra busca ILIKE da aba Pessoas quando a base passar de ~mil contas
- 🟡 [ ] Monitorar cota Neon (100 CU-h/mês free) — alerta em 70%
- 🟢 [ ] Logging estruturado (JSON) em vez de console.error solto
- 🟢 [ ] Paginação/scroll infinito em ranking e histórico
- 🟢 [ ] Tempo real: fila usa polling — avaliar SSE quando houver >20 editores ativos

## 🎨 Front-end & UX

- 🟡 [ ] Passada completa de mobile em TODO fluxo (missão, entrega, inspetor)
- 🟡 [ ] Feedback de sucesso consistente (toast) — hoje erro é inline, sucesso às vezes só recarrega
- 🟡 [ ] Prevenção de perda de formulário (wizard de nova missão com autosave em rascunho)
- 🟡 [ ] Onboarding de primeiro uso: editor novo chega e vê o quê? tour de 3 passos
- 🟢 [ ] Auditoria de acessibilidade (axe/Lighthouse): contraste, foco, navegação por teclado
- 🟢 [ ] Skeleton loaders nas filas
- 🟢 [ ] PWA instalável (editor receber oferta no celular)
- 🟢 [ ] SEO: sitemap.xml, robots.txt, OpenGraph da landing (título/descrição/preview por link)
- 🟢 [ ] Página 500 customizada com link de report

## 📧 E-mail

- 🔴 [ ] Remetente definido (`contato@`?) + `EMAIL_REMETENTE` na Vercel
- 🟡 [ ] Template HTML bonito (hoje texto cru — verificar lib/email.ts)
- 🟡 [ ] E-mails transacionais: boas-vindas, oferta recebida, aprovada, reedição pedida — hoje só recuperação
- 🟡 [ ] Testar entrega real em Gmail/Outlook/Proton (caixa de spam) após verificação
- 🟢 [ ] Rodapé com contato/descadastro (LGPD)

## 🚀 Produto — as faltas de verdade

- 🔴 [ ] **Integração Google Drive** (a maior obra): escopo `drive.file`, liberar pasta do bruto pro editor na oferta, **revogar** ao final — hoje é manual
- 🔴 [ ] Rodar o ciclo completo com as 2 contas reais (missão → oferta → aceitar → entregar → aprovar) — nunca foi feito ponta a ponta em produção
- 🟡 [ ] Notificações in-app (sino): oferta chegando, reedição pedida — editor não vive de polling
- 🟡 [ ] Monetização: SPEC fala em "desbloquear os pagos" — definir modelo (assinatura? por missão?) → Vercel Pro obrigatório
- 🟢 [ ] Comunicação editor ↔ porta-voz por missão (comentários no brief)
- 🟢 [ ] Avaliação bidirecional (tabela avaliações existe — editor avalia porta-voz?)
- 🟢 [ ] Anti-abuso: limite de missões abertas por porta-voz, editor fantasma

## 🧪 Qualidade & DevOps

- 🟡 [ ] E2E com Playwright cobrindo o ciclo inteiro (login → missão → aprovação)
- 🟢 [ ] Lighthouse >= 90 nas principais
- 🟢 [ ] Teste de carga na fila de dispatch (10 editores simultâneos pegando a mesma missão)

---

## Ordem que eu atacaria

1. Sentry + health check + CI (1 dia — produção deixa de ser cega)
2. Testes das libs críticas + E2E do ciclo (3-4 dias — rede de segurança)
3. www + Resend + remetente (já em andamento, auto-resolve)
4. Ciclo completo testado por humanos
5. Drive integration (a obra grande)
6. O resto por prioridade
