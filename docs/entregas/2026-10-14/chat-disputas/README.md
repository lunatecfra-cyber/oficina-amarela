# Chat avançado e disputas (branch `feat/chat-disputes-20261014`)

Estado: **PASS_STAGING** para chat e disputas no domínio não financeiro. Produção, PostgreSQL e dispositivos móveis físicos não foram validados. Nada foi enviado com push.

## Reconciliação (Etapa 0)

- Base: `master` em `4fc7b52`, que já inclui RBAC (`9e1182e`, `5ddec9c`) e Videoaulas (`461c7d5`, `58af1d7`, `4fc7b52`). `stash@{0}`, os arquivos não rastreados e as evidências antigas de `rbac-e2e/` não foram tocados.
- Trabalho em worktree isolado (`../oficina-amarela-chat-disputes`), para não disputar arquivos com a outra sessão.
- Staging tinha o esquema até a `0023`. A `0024` (Videoaulas) apareceu depois, aplicada por outra sessão; **não foi aplicada por esta**. Aplicadas aqui, só aditivas: `0025`, `0026`, `0027`. A tabela `d1_migrations` de staging é vazia (migrações entram por script), então o esquema foi conferido por objetos: 5 tabelas, 25 triggers, 4 views, capacidades presentes e `PRAGMA foreign_key_check` vazio.
- Versões de staging antes do deploy (alvo de rollback): API `6d360bbe-1400-4465-9de6-c469013ec114`, web `d6fa7628-244c-4361-8b3f-092b7fe9868d`. Publicadas: API `99357369-3adc-46bc-9242-88cb64fbfc73`, web `f7088410-65f2-4f0d-830d-ae3c445b3d2c`, ambas do commit `8ea7d46` (HEAD de `master` + esta branch, com a `0024` já presente em staging). O deploy substitui o que outra sessão tinha publicado; a conferência foi feita logo antes.

## Commits

| Commit | Tipo | Conteúdo |
| --- | --- | --- |
| `fe57a98` | fix | Exclusão de conta exige a **senha** quando a conta tem uma; o apelido só confirma contas sem senha (login social). |
| `6b7ac0f` | feat | Cursor de mensagens por `id`, mensagens não lidas por participante, lista de conversas com contagem. |
| `f5602ae` | feat | Marcos do ciclo da missão dentro da conversa. |
| `43c75b7` | feat | Anexos privados no R2 com autorização por missão. |
| `1912608` | feat | Domínio de disputas: mediação, recurso, auditoria. |
| `842b00b` | chore | Comentários e títulos de teste em inglês (regra do projeto). |
| `8ea7d46` | feat | Telas de disputa para as partes e para a equipe. |
| `75d7c5a` | test | Jornada de navegador em staging (desktop e mobile). |

## Migrações

- `0025_chat_read_state.sql`: marcador de leitura persistente por participante e missão.
- `0026_chat_attachments.sql`: `message_attachments`, imutável após o envio.
- `0027_disputes.sql`: `disputes`, rodadas, manifestações, capturas de evidência, mediadores, guardas de conflito de interesse e retenção por trigger. Recria duas views existentes (as de capacidade e de retenção), por isso passou por backup do esquema antes de ir a staging.

## Chat avançado (Etapa 1)

- **Cursor estável:** paginação por `afterId`. O cursor anterior (`created_at >`) perdia mensagens com o mesmo horário; o teste e o E2E inserem duas mensagens com timestamp idêntico e ambas chegam.
- **Não lidas:** `POST /api/missions/:id/read` avança o marcador de forma idempotente (nunca recua); `GET /api/missions/unread` alimenta o aviso "Conversas com novidades" e a navegação entre conversas. O cliente só marca como lido com a aba visível.
- **Anexos:** JPG, PNG, WebP e PDF, até 10 MB. Autorização por missão antes de tocar no R2, conferência dos primeiros bytes contra o tipo declarado, hash SHA-256, nome higienizado, chave `chat/<missão>/<uuid>`. Mensagem e anexo gravam no mesmo lote do D1. Download só para quem participa da missão; imagem abre na página, PDF baixa. O pipeline de validação e download é compartilhado com as disputas (`apps/api/src/attachments.ts`).
- **Marcos da missão:** lidos de `mission_notifications` (sem o campo `notes`, que pode conter comentário de inspeção), sem criar outra fonte de eventos. Ofertas, inspeção pendente e transferências ficam de fora.
- **Notificações:** nenhuma notificação nova foi criada; os marcos reaproveitam os registros existentes, então não há duplicação.
- **Tempo real:** **não implementado.** O polling de 5 s funciona, o D1 segue autoritativo e se recupera sozinho após desconexão. Durable Object com WebSocket hibernation não foi medido contra o polling, então não há vantagem comprovada; a decisão é manter o polling. Revisitar se a carga de conversas simultâneas justificar.

## Disputas (Etapa 2)

Domínio separado de denúncias e de pedidos de reedição.

**Fluxo:** uma das partes abre → o sistema registra a reclamação, o estado da missão e a versão da entrega → as partes enviam manifestações com arquivos → um mediador assume → decisão com fundamentação → recurso (uma vez) com revisor diferente → encerramento. Estados: `open`, `in_review`, `decided`, `appealed`, `closed`. Resultados: `upheld`, `partially_upheld`, `dismissed`. Uma disputa ativa por missão; categorias `quality`, `deadline`, `scope`, `conduct`, `other`.

**Permissões:**

| Quem | Pode |
| --- | --- |
| Porta-voz e editor da missão | Abrir, enviar manifestações, ler o caso, recorrer. |
| Inspetor | Ler (`disputes.read`). Não decide por ser inspetor. |
| Mediador (concessão explícita `disputes.mediate`) | Assumir a rodada 1 e decidi-la. Concedida por quem tem `users.manage`. |
| Admin (`disputes.decide`) | Revisar o recurso e encerrar sem recurso, com justificativa. |
| Qualquer pessoa ligada ao caso | Nunca julga: partes, fiscal da entrega e quem tem vínculo com a missão são barrados por trigger. A revogação da concessão vale na hora, mesmo com cookie antigo. |

Todas as transições gravam auditoria. A decisão da rodada 1 é preservada quando há recurso. Uma disputa retém a missão (a view de retenção das denúncias passou a cobri-la): a conta de um participante não pode ser apagada nem os registros alterados. **Não existe liberação dessa retenção**: sem regra de prazo definida, ela permanece. Definir essa regra é uma pendência de negócio.

### Consequências: o que NÃO está automatizado

A decisão **registra** resultado e fundamentação; não age sobre a missão. Cancelamento, redistribuição e alteração de reputação **dependem de regra de negócio e de aprovação ainda não definidas** e ficam como passo humano:

| Consequência | Estado | Depende de |
| --- | --- | --- |
| Cancelar ou reabrir a missão | Manual | Política: quem pode, e em quais resultados. |
| Redistribuir a outro editor | Manual | Política de reatribuição e prazo. |
| Ajustar reputação ou avaliação | Manual | Critério de impacto por resultado, e se cabe a mediador ou só a admin. |
| Penalidade ao usuário | Fora do escopo | Denúncia de conduta, não disputa. |

### Financeiro: nada simulado

Não há escrow, saldo, liberação ou devolução. Nenhuma tabela financeira foi criada ou alterada. O que existe é apenas uma base para o futuro: uma disputa **ativa** é consultável por missão pela view `disputed_missions`, de modo que uma futura liberação possa ser bloqueada enquanto houver disputa. Isso **não** significa que dinheiro real esteja retido. Carteira, ledger, split e provedor brasileiro seguem como etapa independente, dependente da escolha do provedor.

## Evidências e retenção (Etapa 3)

- Ao abrir a disputa, um trigger copia para `dispute_evidence` um **snapshot das linhas do D1**: a missão e seu estado, mensagens, entregas, inspeções, atribuições, participantes e o **manifesto** dos anexos do chat (nome, tipo, tamanho, SHA-256 e chave do objeto). Os snapshots são imutáveis e não podem ser apagados. Os **bytes** dos anexos não são copiados. O download dos anexos da disputa passa pela autorização do caso.
- **Limite, igual ao das denúncias:** os bytes continuam em `missions/` e `chat/` no R2, **sem Bucket Lock nem expiração**. A retenção é lógica (D1). Quem tem credencial Cloudflare pode apagar objetos. **As evidências não podem ser declaradas imutáveis.**
- **Proposta (não aplicada, precisa de aprovação específica):** (a) copiar os bytes relevantes para `evidence/<caso>/` ao abrir denúncia ou disputa, gravando manifesto com hash; a cópia grava o objeto primeiro e o registro depois, e uma cópia sem registro é reprocessável (o hash identifica), o que tolera falha parcial entre R2 e D1; (b) só então avaliar regra de lock no prefixo `evidence/`, testada antes em staging, ciente de que ela não se desfaz antes do prazo.
- Nenhum lock ou retenção irreversível foi configurado.

## Testes

| Camada | Resultado |
| --- | --- |
| Suíte do repositório (HEAD `75d7c5a`) | **331 testes, 0 falhas, 0 pulados**; typecheck sem erro. A base tinha 320. |
| Navegador em staging, desktop 1440×1000 e mobile 390×844 | **PASS, 14 verificações em cada viewport** (28). |

Cobertura dos testes novos: cursor com timestamps iguais, idempotência de leitura, isolamento entre missões, acesso depois de transferência do editor e depois de ban, tipo falso e tamanho excedido em anexos, download negado a quem não participa, ciclo completo da disputa (abertura, manifestação, decisão, recurso, encerramento), impedimento por vínculo, mediador-parte, revogação imediata, justificativa obrigatória, concorrência na decisão, auditoria e imutabilidade.

A jornada de navegador cobre: aviso de não lidas, abertura da conversa e limpeza do aviso, duas mensagens com o mesmo horário, marco do ciclo, envio e recebimento de anexo, recusa a um terceiro (403), formulário e abertura da disputa, manifestação com arquivo, decisão, recurso decidido, trilha de auditoria e revogação da concessão. Script: `scripts/testar-chat-disputas-staging.mjs`.

**Não coberto por teste automatizado:** carga com muitas conversas simultâneas; falha parcial real entre R2 e D1 em produção; PostgreSQL (o repositório de disputas tem stub que falha fechado).

## Falhas do próprio ensaio (sem defeito do produto)

1. Esperar `networkidle` nunca terminava, porque o chat faz polling a cada 5 s. Trocado por `load`.
2. O guia "Como usar" abria depois da hidratação e cobria cliques; o script agora espera brevemente por ele.
3. `response.json()` do Playwright penduraria depois do upload; o id do anexo passou a vir do D1.
4. O inspetor vê as disputas de todos os viewports na lista; o seletor passou a usar o `href` da disputa corrente.

## Evidências (fora do Git)

`~/evidencias/oficina-amarela/2026-10-14-chat-disputas-staging/` (21 MB): 18 screenshots, 12 `*-trace.zip`, `resultado.json` e `run.log`. As contas e missões sintéticas do ensaio permanecem em staging; o script bloqueia as contas ao final.

## Pendências e riscos

- **Staging é compartilhado:** o que está no ar é esta branch. Antes de qualquer nova publicação por outra sessão, conferir que ela inclui as migrações `0025`–`0027`; um build sem elas quebraria chat e disputas. Rollback: versões anteriores acima.
- **Merge em `master`:** a branch parte de `4fc7b52`. Se a outra sessão seguir commitando, haverá conciliação de migrações (numeração `0025`+).
- Regra de prazo para liberar a retenção por disputa (hoje não há liberação).
- Regras de consequência das disputas e escolha do provedor financeiro precisam de decisão de negócio.
- Aprovar (ou não) a cópia para `evidence/` e o lock de R2.
- Mover `rbac-e2e/browser/` e `rbac-e2e/browser-aceite/` (77 MB, não rastreados em `master`) para fora do repositório ou ignorá-los.
