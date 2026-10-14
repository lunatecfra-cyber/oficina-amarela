# Moderação auditável e preservação de evidências — staging

Entrega de 14/10/2026 sobre os fluxos existentes. Produção não foi alterada.

## Implementação

- Migração `0018_report_evidence.sql`: captura atômica na abertura da denúncia, com missão, mensagens, entregas, inspeções, atribuições e identidade dos participantes. Denúncias abertas anteriores recebem captura identificada como `migration`, sem inventar o estado original.
- Decisão com responsável, nome, justificativa e data; decisão e auditoria são uma única operação. Repetição idêntica é idempotente; decisão concorrente diferente é recusada. Partes envolvidas e o fiscal da entrega ficam impedidos de decidir.
- Encerrar denúncia mantém retenção. Missão, conta participante, mensagens, entregas e inspeções ficam protegidas contra exclusão enquanto houver retenção. Exclusão bloqueada não desfaz a atribuição da missão.
- Entregas históricas e decisões não podem ser sobrescritas. Liberação de retenção é outro evento imutável e auditado, exige justificativa e a capacidade `release_report_retention`; papel `admin` sozinho não concede essa capacidade. Nenhum prazo automático foi presumido.
- Painel de denúncias exibe responsável e justificativa, permite baixar a captura e mostra retenção. API revalida papel e bloqueio da conta e responde com `private, no-store`.

## Publicação e verificação

- D1 de staging recebeu a migração após exportação de segurança em `/tmp/oficina-before-moderacao-staging.sql` (permissão 600). Na conferência anterior à migração não havia denúncias abertas.
- API: versão `b0ee5a86-8ee4-4e19-b751-493354ff30de`.
- Frontend: versão `feb374a5-8055-408e-bf7d-d9f05a3dd781`, Service Binding para `oficina-amarela-api-staging`.
- Regressão local: 295 testes aprovados, typecheck aprovado e Biome nos arquivos alterados. Dois testes dirigidos de evidência foram repetidos na retomada e passaram; incluem rollback de falha na auditoria, concorrência, impedimentos, imutabilidade e exclusão sem efeitos parciais.
- [staging.json](./staging.json): 35 verificações por HTTP e Service Binding, missão `47`, denúncia `2`. Cadastro com convite, atribuição exclusiva, chat privado, upload real de MP4, entrega v1, reedição, entrega v2, rejeição de versão antiga, inspeção independente, aceite, avaliação, denúncia, consulta de captura pelo frontend, concorrência e repetição da decisão, retenção, liberação concorrente idempotente e revogação imediata da capacidade.
- Duas aceitações do mesmo editor retornam 200 por idempotência; outro editor recebe 409. O banco confirmou uma única atribuição ativa. Há uma única auditoria de decisão e uma única auditoria de liberação; `foreign_key_check` não encontrou violações.
- [cleanup.json](./cleanup.json): conferência posterior da revogação das seis contas sintéticas e remoção da capacidade temporária. Registros e mídia sintéticos foram preservados.

Reprodução: `node scripts/testar-moderacao-staging.mjs <resultado.json>`. Os destinos são fixos de staging; requer autenticação Cloudflare, Bun e ffmpeg. Reexecuções rápidas podem atingir o limite normal de cadastros por IP. Na retomada foram corrigidas expectativas de status do script (cadastro 200, convite ao editor 201) e removidos apenas os contadores desta origem e janela de ensaio; nenhuma regra de limite foi alterada.

## Limites e pendências

O ensaio foi por HTTP, não pelo navegador; renderização, interação e upload pela interface permanecem sem aceite visual. PostgreSQL não recebeu esta implementação: decisão auditável falha fechada fora do D1.

A captura preserva registros e referências disponíveis na abertura. Links externos não são cópias dos arquivos e podem mudar; o armazenamento privado R2 não tem exclusão exposta por estes fluxos. Políticas administrativas ou de ciclo de vida do bucket não foram validadas nesta entrega.

A separação de capacidades cobre liberação de retenção. Inspetor ainda usa `admin` nos demais fluxos; separação geral antes de arbitragem sensível continua pendente. Chat com não lidas/anexos/eventos e cursor composto, disputas, carteira, gateway e escrow continuam fora desta fatia. Não foram feitas alterações no Jira nem publicação em produção.
