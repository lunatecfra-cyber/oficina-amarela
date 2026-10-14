# Onboarding e operações de inspeção — staging, 14/10/2026

Implementação na branch `integration/onboarding-rbac-20261014`, checkout `/tmp/oficina-onboarding-rbac-20261014`. O checkout principal com alterações paralelas foi preservado. Esta branch integra os commits de onboarding à implementação paralela de moderação e RBAC por capacidades; não publicar o checkout principal isoladamente sobre esta integração.

## Entrega

- Iniciante: cadastro, perfil, especialidades, disponibilidade, missões gratuitas e primeiras três entregas inspecionadas, sem selo ou estrelas artificiais.
- Experiente: convite ADMIN com hash, tipo, e-mail vinculado, uso único, expiração/revogação e auditoria. Origem administrativa persistente, primeira entrega inspecionada, sem cinco missões gratuitas obrigatórias.
- Voluntário: `workPreference=volunteer` persiste após novo login. Pagamentos continuam desativados.
- Reconciliação: convite resgatado prova origem; selo ativo é qualificação atual; `paidEligible` requer ambos. Somente ADMIN administra convites/selo. Revogar selo não apaga proveniência. INSPECTOR é fiscalização técnica independente e não recebe essas permissões.
- INSPECTOR: fila própria, atribuição exclusiva por versão, acesso às entregas necessárias e ao histórico, aprovação/ajuste com motivo, ator e data. Impede autoinspeção inclusive por ex-editor e porta-voz. Não acessa conversas completas nem arquivos privados fora das entregas atribuídas.
- Capacidades e sessões revalidadas contra a conta atual; revogação corta imediatamente fila e mídia. Não permite alterar estrelas, finanças, propriedade da conta ou promover papéis.
- Fila: status, motivo, versão, editor, prazo, espera, filtros, estados vazios/carregando/erro, feedback de ação e histórico após finalização. Filtra trabalho concluído sem atribuição para evitar ações sem autorização. Datas desconhecidas não viram 1969/NaN; prazos sem horário preservam a data brasileira.
- Navegação: login, Google, proxy, cabeçalhos, ajuda e proteção de áreas por papel. Mantida identidade escura/amarela; sem redesign global.

## Verificação

- Regressão ampla da integração: 306 testes passaram (`/tmp/oficina-onboarding-rbac-release-tests.log`). Typecheck passou (`/tmp/oficina-inspection-time-types.log`).
- Após os últimos ajustes: jornada D1 de inspeção 2/2 (`/tmp/oficina-onboarding-rbac-queue-final.log`); pacote web 21/21, incluindo dois novos testes de datas (`/tmp/oficina-inspection-time-web-tests.log`). Total atual dos testes por pacote: 308.
- Build e deploy exclusivamente staging. API: `9960a39d-3ebd-4764-81f3-b86574a030b6`. Web final: consultar `/tmp/oficina-onboarding-rbac-web-final-deploy.log`.
- Ensaio remoto autenticado por HTTP nas missões **53 e 54**, com contas sintéticas distintas, upload R2 real, ajustes v1, correção v2, aprovação técnica da versão atual, aprovação/nota real pelo porta-voz, IDOR, negação de alteração de estrelas/selo/role, mídia por atribuição e revogação de capacidade. Portfólio publicado e revogado; mídia retorna 404 após revogação. Resultado sanitizado em `staging-journey.json`.
- O ensaio foi retomado após uma expectativa do script usar uma rota interna inexistente na superfície web (404). A API interna permanece coberta por testes de 403. Foram reutilizadas as contas e entregas já criadas; não se repetiu o cadastro.
- UI final: login de INSPECTOR dedicado abre `/inspetor` sem ciclo e mostra Missões/Denúncias; estado vazio útil. Capturas desktop/mobile anteriores desta mesma implementação estão neste diretório; não equivalem a uma nova auditoria visual de todas as páginas após integração.
- Migração 0023 aplicada após export completo do D1; 67 usuários, 12 entregas e 9 evidências preservados, sem violações de FK. Ver `migration-check.json`. Backup com acesso restrito em `/tmp`; não versionar dados nem credenciais.

## Limites e decisões pendentes

`STAGING_INSPECTION_ALL=true` continua exigindo inspeção de todas as entregas em homologação. Percentual de amostragem, limiares objetivos de criticidade/histórico e recursos continuam sem decisão. Não são política permanente de produção. ONCA-5/126 não devem ser encerradas enquanto esses critérios estiverem pendentes.

ONCA-120 continua sendo homologação ampla V2: este ensaio cobre onboarding/inspeção e regressão de portfólio, sem afirmar cobertura integral de toda a V2. ONCA-60 tem navegação corrigida nesta fatia, mas requer fechamento de seus demais critérios. ONCA-11 e ONCA-10 completos não executados nesta fatia. PostgreSQL externo e problemas globais de Biome não foram revalidados/corrigidos. Nenhuma alteração em produção, ativação de pagamentos ou notificação externa real.
