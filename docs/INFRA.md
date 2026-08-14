# Ferramentas da Oficina Amarela

Onde cada coisa mora, o que está ligado e o que falta.
**Tudo conferido contra o serviço real, não contra arquivo de configuração** —
que foi justamente onde uma auditoria se perdeu no passado.

Custo mensal hoje: **R$ 0**

| Serviço | Plano | Limite | Situação |
|---------|-------|--------|----------|
| Vercel | Hobby | uso não comercial | ativo |
| Neon | Free | 0,5 GB · 100 CU-h/mês | ativo |
| Resend | Free | 3.000 e-mails/mês | chave posta, domínio não verificado |
| registro.br | anual | — | domínio registrado |
| GitHub | Free | — | ativo |
| Sentry | — | — | instalado, sem chave |

## Onde mora cada coisa

### Site — Vercel (no ar)
- **Endereço:** oficina-amarela-woad.vercel.app
- **Conta:** lunatecfra-8222s-projects · plano Hobby
- **Projeto:** oficina-amarela
- **IDs:** prj_Ecbla180nmGRgHina0nCCv36EEa5 · team_2S1CytUcbJDWpiQoe8cndmc2

> Esse endereço é estável — os links com código no meio
> (`oficina-amarela-8zph…`) mudam a cada publicação. Existe uma conta Vercel
> antiga, `vitaomfs-projects`, e o domínio ainda está vinculado a ela: é por
> isso que a verificação pede um registro `_vercel` no DNS.

### Banco de dados — Neon · Postgres 18 (com dados)
- **Host:** ep-small-hat-aylon50d-pooler.c-5.us-east-2.aws.neon.tech
- **Banco:** neondb · usuário neondb_owner · região us-east-2
- **Conteúdo:** 7 tabelas · 2 contas · 0 missões
- **Contas:** vitor.200256 (admin) · lunatecfra (editor)

> A conexão usa o pooler, e é por isso que o código desliga prepared
> statements. O `.env.local` da máquina de desenvolvimento aponta para um
> Postgres **local**, não para este — não confundir.

### Envio de e-mail — Resend (meio caminho)
- **Conta:** vitor.200256@gmail.com
- **Chave:** `re_Pixi…` · permissão só de envio · já configurada na Vercel
- **Remetente:** onboarding@resend.dev (sandbox)
- **Domínio:** oficinaamarela.com.br — **não verificado**

> Enquanto o domínio não for verificado, o Resend só entrega no e-mail do
> dono da conta. Por isso a tela de recuperação não promete envio — prometer
> aqui seria mentir.

### Domínio — registro.br (DNS pendente)
- **Domínio:** oficinaamarela.com.br
- **Servidores:** a.auto.dns.br · b.auto.dns.br (do próprio registro.br)
- **Zona hoje:** `v=spf1 -all` · MX nulo
- **Falta:** 8 registros — Vercel (3) e Resend (3), mais SPF e A

> O `v=spf1 -all` de hoje declara que ninguém pode mandar e-mail por este
> domínio. É o padrão do registro.br para domínio sem e-mail, e precisa ser
> **trocado** — não duplicado: dois SPF no mesmo nome se anulam.

### Entrar com o Google — Google Cloud (funcionando)
- **Permissões:** openid · email · profile
- **Retorno:** /api/auth/google/callback
- **Testado:** 13/08 17:37 — conta criada de verdade

> Não pede acesso ao Drive, e o projeto não faz nenhuma chamada à API do
> Drive. Liberar a pasta continua sendo manual — é a maior obra pendente do
> produto.

### Código — GitHub (em dia)
- **Repositório:** lunatecfra-cyber/oficina-amarela · branch master
- **Base:** Next 16.3.0 · React 19.2.4 · Tailwind 4
- **Bibliotecas:** postgres 3.4 · jose 6.2 · bcryptjs 3.0 · resend 6.18

### Monitoramento de erros — Sentry (desligado)
- **Situação:** biblioteca instalada, sem chave configurada

> Sem a chave, o Sentry não registra nada — nem erro, nem acesso. Silêncio
> dele não é sinal de que está tudo bem; é sinal de que ninguém está olhando.

## Chaves configuradas na Vercel

| Nome | Para quê | Situação |
|------|----------|----------|
| DATABASE_URL | banco | configurada |
| AUTH_SECRET | assina a sessão | configurada |
| GOOGLE_CLIENT_ID | login Google | configurada |
| GOOGLE_CLIENT_SECRET | login Google | configurada |
| RESEND_API_KEY | envio de e-mail | configurada |
| EMAIL_REMETENTE | de quem sai o e-mail | **falta** — depende do domínio |
| NEXT_PUBLIC_SENTRY_DSN | erros | **falta** — opcional |

## O que falta, em ordem

1. **(você)** Colar os 8 registros no registro.br. Destrava o domínio e o
   envio de e-mail de uma vez só.
2. **(eu)** Ligar o `EMAIL_REMETENTE` assim que o Resend marcar o domínio
   como verificado. Nenhum código muda.
3. **(você)** Rodar o ciclo completo com as duas contas — criar missão,
   receber oferta, aceitar, entregar, aprovar, aceitar.
4. **(decidir)** Duas chaves foram compartilhadas em chat — a do banco e a do
   e-mail. A do banco ficou como está. A do Resend é trocável em um minuto e
   não quebra nada.
5. **(saber)** O plano Hobby da Vercel proíbe uso comercial. Hoje o projeto
   não cobra nada de ninguém e é defensável como pessoal. No dia que
   monetizar, deixa de ser permitido.

---

Conferido em 13/08/2026 contra os serviços em produção.
Nenhuma senha ou chave completa aparece aqui — só identificadores truncados.
