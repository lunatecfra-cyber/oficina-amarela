# Extração de padrões de marketplaces — Oficina Amarela

Data: 14/10/2026. Prioridade: lançamento de 28/11/2026.

## Escopo e evidência

Preservar Cloudflare Workers + Hono + D1 + Durable Objects + R2 + Queues, o frontend existente e a infraestrutura. Next.js, Node.js e Prisma nas referências são detalhes de implementação: extrair contratos e regras, sem transplantar runtime, ORM ou aplicação.

Esta entrega é documental. Não implementa funcionalidades, altera migrations, provisiona recursos ou publica mudanças. Callers, testes, fixtures, exports e configurações existentes não precisam mudar. Os pontos que uma implementação futura teria de alcançar estão inventariados abaixo.

Leitura estática dos clones públicos, sem executar as aplicações externas, instalar dependências ou acessar ambientes privados:

| Fonte | Revisão examinada | Limite |
| --- | --- | --- |
| Oficina Amarela | `c9aadebe8edff155ed9aa565c376b0dd8a44b0fe` | Árvore local inicialmente limpa; código e migrations não comprovam implantação ou aceitação em produção. |
| [TrustLance](https://github.com/Thushar070/trustlance/tree/684e89b36ae22d4f2c78b3ebbd257dd38bdec916) | `684e89b36ae22d4f2c78b3ebbd257dd38bdec916` | Serviços, rotas, schema e README; comportamento de produção não verificado. |
| [Freelancezero](https://github.com/freelancezero/freelancezero/tree/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb) | `c833f9f7f526d6e1f60b2c96a64caed84dfe4deb` | Modelos amplos, mas várias operações só aparecem como schema, comentários ou interfaces. |

Classificações se referem à decisão para Oficina Amarela:

- `ALREADY_IMPLEMENTED`: existe no código local; reutilizar, sem presumir validação em produção.
- `ADAPT`: estender o fluxo existente com a regra identificada.
- `NEW_FEATURE`: capacidade ausente que exige implementação própria.
- `REJECT`: não transferir a implementação ou a garantia anunciada.

## Matriz de extração

| Padrão | Evidência nas referências | Oficina Amarela hoje | Classificação e decisão |
| --- | --- | --- | --- |
| Conversa privada por missão | TrustLance valida cliente/editor em `MessageService`; Freelancezero verifica participantes no POST de mensagens. [T2, F2] | Hono + D1 verificam porta-voz proprietário, editor atribuído ou `admin`; histórico persistido. [O1] | `ALREADY_IMPLEMENTED`: manter contratos e UI. |
| Tempo real com hibernação | Freelancezero usa polling de 5 s; o adapter de realtime não publica eventos. [F3] | `MissionChat` também usa polling de 5 s. `MissionCoordinator` coordena reservas, sem WebSockets. [O1, O2] | `ADAPT`: DO de conversa por missão com histórico D1; não reescrever a coordenação de reservas. |
| Não lidas, anexos e eventos no chat | Freelancezero implementa `lastReadAt` e contagem de não lidas; `FILE`/`SYSTEM` estão no schema, enquanto o POST examinado só recebe texto. [F1, F2] | Mensagens de texto; notificações e auditoria do ciclo existem separadamente. Upload R2 é para vídeo de entrega. [O1, O3] | `ADAPT`: marcador de leitura, vínculo de anexos privados e projeção dos eventos existentes; tipos no schema externo não provam fluxo completo. |
| Denúncias e fila de moderação | TrustLance tem denúncia de usuário e listagem administrativa, sem categoria ou resolução no modelo `Report`. [T3] | Denúncia da missão identifica contraparte; painel lista e resolve/ignora. Bloqueios e correções administrativas já existem. [O4] | `ALREADY_IMPLEMENTED`: reutilizar denúncia/painel; denúncia não equivale a disputa. |
| Categorias, sanções e histórico do caso | Não foi comprovado um fluxo completo nas referências examinadas. | `resolveReport` atualiza status/data sem registrar ator, justificativa ou evento de auditoria nessa operação. [O4] | `ADAPT`: categoria, responsável, motivo e auditoria; ligar sanções existentes ao caso, sem duplicar o sistema de bloqueio. |
| Disputa formal e congelamento | TrustLance restringe abertura às partes em revisão, cria disputa e transiciona escrow; evidência por parte, resolução administrativa com motivo. [T1] Freelancezero possui `Dispute`, sem fluxo equivalente localizado no código examinado. [F1] | Há denúncias, reedições e inspeções; nenhum caso financeiro/disputa formal localizado. | `NEW_FEATURE`: caso D1 separado, evidências R2, congelamento de liberação e decisões auditadas. |
| Mediador e recurso | Nenhum campo de atribuição de mediador ou fluxo de recurso localizado nos schemas/serviços examinados. `ADMIN_REVIEW` ou `ESCALATED` não comprovam essas operações. [T1, F1] | Papel de inspetor é `admin`, sem capacidade financeira separada. [O5] | `NEW_FEATURE`: atribuição explícita, impedimento por conflito e recurso preservando decisão anterior; regras e prazos ainda precisam ser definidos. |
| Carteira e razão contábil | TrustLance tem um `Payment` e um `Escrow` por projeto. Freelancezero tem um `Payment` mutável por milestone; não é razão de partidas dobradas. [T4, F1, F3] | Nenhum ledger/carteira localizado; checklist histórico registra operação sem cobrança. [O6] | `NEW_FEATURE`: partidas dobradas D1 e provedor brasileiro somente para uma etapa financeira definida; não fazer disso dependência implícita do lançamento. |
| Financiamento/liberação apenas por status | TrustLance altera escrow na resolução; essa operação não chama payout/refund do provedor. Freelancezero retorna `ESCROW_FUNDED`/`RELEASED` no adapter manual sem verificar transferência. [T1, F3] | Aprovação, reputação e ranking são eventos de produto, não confirmação financeira. [O3] | `REJECT`: status local ou notificação jamais comprovam dinheiro retido, liberado ou devolvido. |
| Entregas, versões e reedição | TrustLance cria `Submission`; Freelancezero modela `Deliverable` com status e nota de ajuste. [T5, F1] | `mission_deliveries`, `delivery_version`, inspeção por versão, revisão e arquivo privado R2. [O3] | `ALREADY_IMPLEMENTED`: estender esses registros, sem criar contratos/milestones paralelos para a mesma missão. |
| Prazo de aceite e liberação automática | TrustLance seleciona entregas antigas com janela padrão de 5 dias e exclui disputas ativas; execução muda estados locais. [T6] | Inspeção necessária e aceite da versão atual controlam conclusão. [O3] | `ADAPT` para prazo de resposta quando definido; `REJECT` para copiar prazo de 5 dias ou liberar dinheiro por silêncio sem política/provedor. |
| Avaliação verificada e reputação | TrustLance modela nota única por projeto/autor; Freelancezero comenta publicação dupla, mas não foi localizada operação que assegure essa regra. [T4, F1] | Voto do porta-voz só após conclusão, versão válida e inspeção quando exigida; unicidade, preservação contra UPDATE e anulação auditada. [O7] | `ALREADY_IMPLEMENTED`: manter fonte comprovada, excluir votos legados/anulados da média pública. |
| Situação da conta e efeito de disputas | Modelos externos não comprovam uma política de penalização confiável. | Conta bloqueada e métricas de entregas/ranking existem; não há resultado de disputa para derivar métricas. [O4, O7] | `ADAPT` depois de existir caso: derivar de decisões finais, sem penalizar denúncia aberta ou expor evidência privada. |
| Troca de stack e cópia de código | Referências dependem de Prisma/PostgreSQL, NextAuth e integrações próprias. | Backend e fronteiras Cloudflare já estabelecidos. | `REJECT`: migração de runtime, importação de app, dependências novas e abstrações de adapters sem necessidade concreta. |

## Um ciclo auditável, sem substituir a máquina existente

O ciclo local conserva seus estados: oferta → `reservada` → `em_revisao` → inspeção quando exigida → `aprovada` → aceite/conclusão `finalizada`. `reedicao` retorna à produção e gera uma nova versão. Inspeção aprovada e conclusão pelo porta-voz são eventos distintos.

Quando existir financiamento real, modelar o estado financeiro separadamente e vinculá-lo à missão. A sequência financiada desejada é: financiamento confirmado pelo provedor → aceite pelo editor → produção/chat/arquivos → entrega → aceite e inspeção conforme política → solicitação de liberação → confirmação do provedor. A sequência atual de inspeção deve continuar governada pela política existente; não inverter suas etapas por semelhança com um marketplace.

Disputa é uma ramificação própria: abertura → congelamento da liberação → evidências das partes → responsável atribuído → decisão fundamentada → recurso, quando cabível → execução financeira confirmada. Pedido de reedição segue no fluxo normal e não abre automaticamente disputa.

### Preservação de evidência

Histórico versionado ainda não equivale a evidência imutável. `mission_deliveries` armazena links e tem exclusão em cascata; não foi localizado bloqueio de UPDATE/DELETE nessas tabelas. Mensagens dependem de dados atuais de `users`; identidade exibida pode mudar. R2 privado protege acesso, mas, por si só, não assegura preservação dos bytes. A rota administrativa de exclusão de missão também precisa respeitar retenção de caso.

Na abertura futura do caso, registrar uma fotografia do briefing e termos aceitos (preço/moeda/prazo quando existirem), participantes, histórico completo até um cursor estável, todas as versões relevantes e inspeções. Links externos mutáveis são referências; preservar os bytes relevantes em R2 com chave exclusiva, hash, tamanho, MIME, autor e data. Hash detecta alteração, não impede exclusão. Aplicar retenção e autorização aos caminhos de escrita/exclusão; compatibilizar isso com a política de dados pessoais.

Usar D1 para manifesto e eventos do caso. A cópia R2 e a gravação D1 não são uma única transação: caso deve indicar evidência pendente/incompleta, impedir liberação enquanto a captura necessária não terminar e permitir recuperação idempotente. Evidência posterior é novo registro, nunca substituição. Recurso referencia a decisão anterior; não a sobrescreve.

### Autoridade e fronteiras financeiras

| Ator | Regra proposta | Diferença atual |
| --- | --- | --- |
| Porta-voz/editor da missão | Consultar seu caso, apresentar evidências e solicitar recurso conforme política. | Acesso à colaboração já usa participantes atuais; preservar os participantes originais do caso mesmo após transferência. |
| Inspetor atribuído | Gerir evidências, inspeção e encaminhamento; sem liberar/devolver valores ou aplicar ações sensíveis de conta. | Hoje o papel `admin` dá poderes amplos; não basta renomear a interface. |
| Administrador autorizado | Arbitrar finanças e ações sensíveis com motivo, auditoria e impedimento quando parte interessada. | Criar capacidade explícita antes de qualquer endpoint financeiro; cookie com `role=admin` sozinho não resolve a separação. |

Ledger futuro: valores inteiros em centavos, moeda explícita, soma equilibrada por lançamento/moeda, entradas imutáveis, correções por estorno e chave única por operação. Disponível, pendente, reservado e retirado derivam das entradas; distinguir saldo disponível de retiradas acumuladas e valores externos ainda não conciliados.

Webhook autenticado e evento único do provedor confirmam os efeitos financeiros. Duplicatas, eventos fora de ordem, timeout após sucesso externo, reembolso e divergência de conciliação devem conservar estado desconhecido/pendente até confirmação. D1 não torna a chamada ao provedor atômica: intenção/outbox persistida, chave estável no provedor e conciliação são necessárias. Não selecionar provedor nem prometer custódia/escrow brasileiro a partir de Razorpay, INR ou do adapter manual externo.

## Prioridade para 28/11

1. **Aceitar o fluxo já existente:** cadastro/permissões → atribuição única → chat privado → upload/entrega → reedição → inspeção → conclusão → avaliação. Reutilizar testes locais e fazer aceite em staging; este documento não comprova esse aceite.
2. **Fechar lacunas operacionais de evidência/moderação:** decisões de denúncia com ator/motivo, acesso privado, preservação de versões e caminhos de exclusão. São candidatos de maior valor; cada implementação deve partir de uma falha ou requisito confirmado.
3. **Chat avançado:** não lidas/eventos/anexos e DO com hibernação entram conforme necessidade do lançamento e validação; polling existente continua utilizável enquanto isso.
4. **Disputa formal, mediação/recurso e carteira:** etapa própria. A data não autoriza pagamentos; provedor, política financeira, permissões e retenção ainda precisam de definição. Se o lançamento incluir dinheiro real, esses controles financeiros passam a ser requisitos de aceite antes de operar.

O [checklist antigo](CHECKLIST-LANCAMENTO.md) e o [documento de arquitetura de agosto](CLOUDFLARE_ARCHITECTURE.md) contêm descrições anteriores à migração. Não usar referências a Vercel/Neon ou funcionalidades futuras desses documentos como retrato da infraestrutura atual. Esta análise parte do código local e do mandato arquitetural acima.

## Superfície de futuras mudanças e verificações

| Fatia | Pontos a alcançar | Verificação necessária |
| --- | --- | --- |
| Chat | Repositório/interface de colaboração, Hono, proxy HTTP/service binding, `MissionChat`, D1; para DO, classe/export/binding/migration nos ambientes existentes. | Estranho negado; ator derivado da sessão; revogação/transferência fecha acesso; reconexão/hibernação recupera histórico; retry não duplica; mensagens com timestamp igual não se perdem. O cursor atual usa somente `created_at > after`: usar sequência/ID estável na adaptação. |
| Entregas/evidências | `mission-lifecycle`, `mission-approval`, `mission-files`, histórico/migrations e exclusão de missão/conta; formulários/proxies existentes. | Versão antiga não aprova nova; inspeção independente; referência privada; bytes preservados; tentativa de alteração/exclusão negada durante retenção; falha R2/D1 permanece explícita. |
| Moderação/permissões | `admin-routes`, `admin`, sessões/roles, dashboard de denúncias e operações sensíveis. | Inspetor sem capacidade financeira; autor/justificativa persistidos; decisão concorrente/repetida não sobrescreve histórico; conflito de interesse negado. |
| Disputa/finanças | Caso e ledger D1, Hono, R2, consumidor de Queue/outbox existente, provedor quando escolhido, dashboards. | Disputa e liberação concorrentes; freeze efetivo; duplicata/reordenação; lote D1 revertido inteiro; débito/crédito equilibrados; timeout externo conciliável; recurso mantém decisão original. |
| Reputação | `mission-reviews`, diretório/ranking/perfil e métricas derivadas existentes. | Voto único verificável; legado/anulado fora da média; caso aberto não vira punição; dados privados fora do perfil. |

Testes locais identificados, **não executados nesta entrega documental**: `packages/db/src/d1/registration-journey.test.ts`, `mission-files.test.ts`, `mission-lifecycle.test.ts`, `mission-approval.test.ts`, `admin.test.ts`, `ranking-admin.test.ts`, `email-queue.test.ts`; `apps/api/src/routes/mission-collaboration.test.ts` (este usa PostgreSQL e exige seu ambiente). Ampliar a suite pertinente na implementação, sem substituir teste real de provedor por fixture de status.

As referências declaram scripts de Jest/Playwright, mas não foram localizados arquivos de testes correspondentes versionados no inventário consultado; TrustLance ignora `__tests__` e `*.test.*`/`*.spec.*`. Script declarado não comprova cobertura. Nenhuma suite externa foi executada.

## Fontes fixadas

Os links externos abaixo devem apontar à revisão auditada, não ao HEAD móvel.

- **T1:** [DisputeService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/dispute-service.ts), [ProjectService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/project-service.ts) (`raiseDispute`), `lib/services/escrow-service.ts`, `app/api/disputes/[id]/route.ts`, `app/api/disputes/[id]/resolve/route.ts` e `prisma/schema.prisma` na mesma revisão.
- **T2:** [MessageService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/message-service.ts) — rejeita leitura até de admin não participante. Não copiar essa regra sem adaptar à fiscalização autorizada da Oficina.
- **T3:** [ReportService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/connection-service.ts) e `app/api/admin/reports/route.ts` na mesma revisão.
- **T4:** [Schema](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/prisma/schema.prisma) e [PaymentService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/payment-service.ts) — captura/verificação Razorpay não comprovam a custódia necessária ao produto brasileiro.
- **T5:** [SubmissionService](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/services/submission-service.ts) — grava submissão/projeto antes de transicionar escrow em operações separadas; não copiar essa janela de inconsistência.
- **T6:** [Auto-release](https://github.com/Thushar070/trustlance/blob/684e89b36ae22d4f2c78b3ebbd257dd38bdec916/lib/cron/auto-release.ts) — elegibilidade é lida antes da transação de liberação; congelamento deve ser revalidado atomicamente na execução.
- **F1:** [Freelancezero schema](https://github.com/freelancezero/freelancezero/blob/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb/prisma/schema.prisma).
- **F2:** [POST mensagens](https://github.com/freelancezero/freelancezero/blob/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb/src/app/api/messages/%5Bid%5D/route.ts), `src/app/api/messages/unread/route.ts` e `src/app/messages/[id]/page.tsx` no mesmo commit.
- **F3:** [Payments adapter](https://github.com/freelancezero/freelancezero/blob/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb/src/lib/adapters/payments.ts) e [realtime adapter](https://github.com/freelancezero/freelancezero/blob/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb/src/lib/adapters/realtime.ts).
- **O1:** [Colaboração D1](../packages/db/src/d1/mission-collaboration.ts), [Hono](../apps/api/src/routes/mission-collaboration.ts), [cliente](../apps/web/lib/chat-db.ts), [UI](../apps/web/components/mission-chat.tsx).
- **O2:** [MissionCoordinator](../apps/api/src/durable-objects/mission-coordinator.ts), [bindings existentes](../apps/api/wrangler.jsonc).
- **O3:** [Histórico](../packages/db/d1/0009_mission_deliveries.sql), [inspeções](../packages/db/d1/0010_mission_inspections.sql), [notificações](../packages/db/d1/0011_mission_notifications.sql), [lifecycle](../packages/db/src/d1/mission-lifecycle.ts), [arquivos](../apps/api/src/routes/mission-files.ts), [exclusão](../packages/db/src/d1/missions.ts).
- **O4:** [Admin D1](../packages/db/src/d1/admin.ts), [rotas admin](../apps/api/src/routes/admin-routes.ts), [ranking admin](../packages/db/src/d1/ranking-admin.ts).
- **O5:** [Roles](../packages/domain/src/roles.ts), [sessão e gates](../apps/api/src/session.ts).
- **O6:** [Checklist histórico](CHECKLIST-LANCAMENTO.md).
- **O7:** [Reviews migration](../packages/db/d1/0013_spokesperson_reviews.sql), [review API](../apps/api/src/routes/mission-reviews.ts), [diretório](../apps/api/src/routes/editor-directory.ts).

Cloudflare consultada em 14/10/2026: [WebSockets com hibernação](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [D1 `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Queues: entrega ao menos uma vez](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). `batch()` reverte o lote se uma instrução falhar; isso não inclui R2 ou provedor externo. Queues exige idempotência dos efeitos, não só da entrega.

Licença: [Freelancezero MIT](https://github.com/freelancezero/freelancezero/blob/c833f9f7f526d6e1f60b2c96a64caed84dfe4deb/LICENSE), com preservação de aviso/copyright se houver cópia substancial. Não foi encontrado arquivo de licença no clone TrustLance examinado; usar os padrões como referência, sem presumir permissão para copiar código. Nenhum código externo foi incorporado.
