# Oficina Amarela — Checklist pra colocar no ar

> Pesquisado em 27/07/2026 a partir de checklists de lançamento de SaaS (referências gerais) + LGPD
> (a lei que vale de verdade no Brasil — não GDPR). Adaptado pro que a Oficina Amarela realmente precisa hoje:
> **sem cobrança** (por enquanto), lida com **dado pessoal + token do Google Drive de cada porta-voz** — isso
> pesa mais na parte legal do que num SaaS comum.

## 1. Produto (técnico)

- [x] Fluxo principal completo com dados fake (porta-voz cria → editor reserva/entrega → inspetor aprova)
- [x] Login real funcionando — cadastro, senha, Google e recuperação, testados ponta a ponta.
      Falta só o banco de produção existir.
- [x] Mensagens de erro claras em cada formulário — corrigido em `nova-pauta-form.tsx`: aceitava
      qualquer URL (ex: YouTube) como "link do Drive"; agora valida `drive.google.com` especificamente,
      com mensagem própria. Testado (link errado, link certo, campo vazio).
- [x] Responsivo no celular (testado)
- [x] Estados de carregamento (loading) nas ações que chamam API de verdade — feito em
      `nova-pauta-form.tsx` (enviar) e `fila-pautas.tsx` (reservar/cancelar/entregar), todos com
      disabled + texto próprio durante o delay simulado. Testado.
- [x] Estados vazios (fila vazia, sem missões, "nada pra revisar") — já implementados
- [ ] Testar nos navegadores principais (Chrome, Safari mobile — é onde a galera vai acessar)

## 2. Segurança e infraestrutura

- [x] `.env.local` fora do git (`.gitignore` já cobre)
- [x] HTTPS — automático na Vercel
- [x] **Cabeçalhos de segurança** — HSTS, X-Frame-Options, nosniff, Referrer-Policy,
      Permissions-Policy e CSP (em `Report-Only` até vermos o que quebra). Antes não havia nenhum:
      o site era emoldurável em iframe.
- [x] **Rate limiting** — login (5 tentativas), cadastro (10 por IP) e recuperar senha
      (3 por e-mail, 15 por IP). Contador no Postgres, porque memória não funciona em serverless.
- [x] **Limite de tamanho de entrada** — no servidor, em `lib/limites.ts`. Antes um POST de 56 KB
      gravava tudo, e a foto entrava sem checagem de tamanho nem de tipo.
- [x] **Monitoramento de erro** — Sentry instalado e inerte sem DSN. Falta criar o projeto
      (plano grátis) e pôr `NEXT_PUBLIC_SENTRY_DSN` na Vercel.
- [ ] ~~RLS no Supabase~~ — não se aplica: saímos do Supabase e nunca usamos RLS.
      A autorização é feita no SQL (filtro por `porta_voz_id`/`reservada_por_id`).
- [ ] **Token OAuth do Drive guardado criptografado** — hoje vacuamente seguro: não existe token.
      `lib/oauth-google.ts` pede só `openid email profile`. Vira obrigatório quando a automação
      do Drive existir.
- [ ] Backup do banco — ver seção 2.1 abaixo.

### 2.1 Riscos aceitos conscientemente

Registrado aqui pra ninguém descobrir de surpresa depois.

- **Vercel Hobby proíbe uso comercial.** A definição deles cobre "ganho financeiro de quem
  participa da produção" — processar pagamento, anunciar, carregar anúncio, pedir doação.
  Hoje o projeto não faz nada disso e é defensável como pessoal.
  **No dia que monetizar, o Hobby deixa de ser permitido** (Vercel Pro ~US$ 20/mês, ou migrar).
- **O polling do dispatch queima a cota do banco.** O plano gratuito do Neon dá 100 CU-hours
  (~400 horas de banco acordado por mês) e ele dorme após 5 min sem consulta. Mas
  `components/oferta-missao.tsx` faz polling a cada 15s: enquanto um editor tiver a aba aberta,
  o banco **nunca dorme**. Cerca de 13h/dia de aba aberta esgota a cota, e o banco **suspende**
  até o próximo ciclo (não cobra — suspende). Folgado pra começar.
  A causa é o polling, e o polling existe porque pooler em modo transaction derruba
  `LISTEN/NOTIFY` e função serverless não segura SSE (ver comentário no topo de `lib/fila-db.ts`).
  Uma hospedagem que mantenha instância viva resolveria os dois.
- **Fotos como data URL dentro do banco.** Até 2 MB por linha em `users.foto_url`, puxadas
  em consultas de lista. No Neon free são 0,5 GB — ~250 fotos no teto encheriam o banco.
- **4 vulnerabilidades altas** vindas do próprio `next@16.2.11` (postcss/nanoid/sharp).
  Existe `16.3.0`; subir versão exige testar, porque esta linha tem breaking changes.
- **Sem CI.** Não existe `.github/`; nada roda em PR.

## 3. Legal — LGPD (o que vale no Brasil)

⚠️ Essa seção pesa mais aqui do que num SaaS comum, porque a Oficina Amarela lida com **CPF/e-mail/token de Drive
de porta-vozes e editores reais** — inclusive políticos.

- [x] **Política de Privacidade** — reescrita pra bater com o que a plataforma faz de verdade.
      Ela descrevia o produto FUTURO: token de Drive com escopo `drive.file`, liberação e revogação
      automática de acesso. Nada disso existe. E omitia metade do que é coletado de fato
      (foto, cidade, etiquetas, IP, presença do editor). Falta: revisão de advogado.
- [x] **Termos de Uso** — rascunho em `/termos`. Falta: revisão de advogado.
- [x] **Direito de exclusão de conta e dados** — `DELETE /api/conta` + bloco "Zona de risco" nas
      telas de editar perfil. Confirmação em dois passos; o id vem sempre da sessão, nunca do corpo.
      Apagar devolve pra fila as missões que a pessoa tinha em mãos (senão viravam missão zumbi:
      `status='reservada'` com dono nulo, invisível e presa pra sempre).
- [x] **E-mail de contato visível** — `lunatecfra@gmail.com` em `/termos` e `/privacidade`.
      Antes era o literal `[preencher e-mail de contato]` servido em produção.
- [ ] Base legal clara pra cada tratamento — vira urgente quando o escopo de Drive existir
- [ ] Registro de consentimento — quando e o que o usuário aceitou (login Google + escopo Drive)
- [ ] Se usar Google Analytics/Pixel: aviso de cookies

## 4. Onboarding

- [ ] E-mail de boas-vindas ao criar conta
- [ ] Explicação rápida de "como funciona" no primeiro acesso (papéis: porta-voz / editor / inspetor)
- [ ] Um lugar pra tirar dúvida / reportar problema (nem que seja um e-mail ou grupo)

## 5. Analytics e observabilidade

- [ ] Quantas missões são criadas/reservadas/entregues por semana (métrica de uso real)
- [ ] Google Analytics ou similar, se quiser ver tráfego do site
- [ ] Error tracking (ver item de Sentry acima)

## 6. Operacional

- [ ] Domínio próprio
- [ ] E-mail profissional (ex: contato@...)
- [ ] Instagram/rede social da Oficina Amarela (se for divulgar)

## 7. Só se um dia cobrar (não é o caso agora)

- [ ] Gateway de pagamento + ciclo de assinatura
- [ ] Nota fiscal
- [ ] Política de reembolso

---

Fontes gerais consultadas: checklists de lançamento de SaaS (categorias técnico/legal/analytics/onboarding)
e guias de conformidade LGPD 2026 pra site/plataforma brasileira.
