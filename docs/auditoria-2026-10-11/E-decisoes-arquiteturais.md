# E. Decisões Arquiteturais (alternativas e recomendação)

Recomendações = **PROPOSTA**; dependem de aprovação humana. Confiança: M.

## E-01 Distribuição: controlada × mural aberto × híbrida
| Opção | Prós | Contras |
|---|---|---|
| Manter ofertas controladas | Já funciona em prod (13 ofertas, 0 claims duplicados); fiscalização simples | Não é "mural"; editor não escolhe |
| Mural aberto com reserva transacional | Reaproveita índice único + DO `MissionCoordinator`; autonomia do editor | Corrida por missões boas, perda de controle de prioridade, spam de reservas |
| **Híbrido** (recomendado) | Missão nasce em modo `offered` (atual) ou `open`; mural lista `open`; reserva usa o mesmo caminho transacional; limites (1 ativa, nota mínima, especialidade) como elegibilidade | Dois modos para testar |
**Recomendação:** híbrido, com `distribution_mode` por missão e elegibilidade computada no servidor. Dependência: E-05 (testes de concorrência) antes de abrir o modo `open`. O mural começa só para editores aprovados no onboarding.

## E-02 Reputação
Separar **ranking eleitoral** (existente, por ciclo) de **reputação de serviço** (estrelas, SLA). Não reutilizar uma coisa como a outra. Reaproveitar `reviews`.

## E-03 Avaliação automática de 5★ após 48h
Infla notas e anula o limiar de 3,5. Alternativas: (a) não gerar nota, marcar "sem avaliação" e excluir da média; (b) gerar neutra com peso baixo. **Recomendação:** (a). Usar média bayesiana/mínimo de N avaliações antes de aplicar o limiar 3,5 ou penalidades (amostras pequenas hoje: 2 reviews).

## E-04 Pagamentos
Só depois de decisão jurídica. Padrão: PSP com split e Pix (avaliar Stripe/Pagar.me/Mercado Pago/Asaas — **não pesquisado**), ledger interno imutável em D1, webhooks idempotentes via Queue + tabela de eventos, conciliação em Cron. Evitar custódia própria de dinheiro. Prazos de retenção como configuração, não código.

## E-05 Confiabilidade antes de funcionalidades
Corrigir C-01/C-02/C-04, alinhar checkout com o bundle remoto, criar CI (typecheck + testes + Biome) e ledger de migrations. Staging obrigatório (memória do projeto: migrations passam por staging).

## E-06 Modelo de dados para serviços
Estender `missions` com `service_type` (stories/reels), `complexity`, `plan` (free/cafe/almoco/pizza), `due_at`, `revision_limit`, `specialty`; tabela `editor_specialties`. Aditivo, com defaults que preservam o fluxo atual (**CONFLITO evitado**).

## E-07 Triggers SQL
Manter os invariantes críticos (reserva única), mas novas regras de negócio (preços, limites) na camada de domínio (`packages/domain`), testável sem D1.

## E-08 Pergunta aberta
Exposição pública de dados de editores (nome, WhatsApp, política) → decisão de produto/LGPD antes do diretório.
