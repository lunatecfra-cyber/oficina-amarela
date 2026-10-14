# ONCA-34 e ONCA-61 — portfólio autorizado em staging

Entrega de 14/10/2026. Produção, pagamentos e notificações externas reais não foram alterados. Contas e mídia do ensaio são explicitamente sintéticas.

## Comportamento entregue

O editor prepara uma amostra de uma entrega finalizada armazenada na Oficina, informa título, descrição e especialidades e escolhe um instante do próprio vídeo como prévia. A amostra começa privada. Solicitar publicação não concede acesso a terceiros. O porta-voz responsável deve confirmar a declaração abaixo para autorizar aquela amostra e versão:

> Declaro que tenho todas as permissões necessárias para divulgar esta amostra, nesta versão, no portfólio do editor dentro da Oficina Amarela.

Regra aprovada explicitamente pelo usuário nesta execução: **“Porta-voz pode autorizar quando declarar que tem todas as permissões necessárias.”** Não há atribuição automática de propriedade ou licença por concluir uma missão. A declaração e o autor ficam registrados na auditoria; missão, versão e asset da amostra não podem ser trocados. Alterar sua apresentação retira a publicação e exige nova autorização.

O editor retira amostras do portfólio; o porta-voz ou inspetor revoga a divulgação. Os registros e o arquivo da entrega são preservados. Perfis e busca usam uma projeção com permissão atual. Mídia e imagens são servidas pelo armazenamento privado existente, com autenticação, Range e `no-store`; o backend revalida a permissão antes e depois de ler o objeto. Não são emitidas URLs assinadas ou URLs públicas do R2 para as amostras. Cada novo acesso depende das permissões atuais, mesmo usando uma URL antiga. Conteúdo já recebido ou copiado antes da revogação não pode ser recolhido remotamente.

O diretório existente ganhou contagem de amostras autorizadas, preferências voluntário/remunerado/ambos, selo concedido e revogado pelo inspetor com motivo auditado e entregas no prazo com proveniência. O selo não altera estrelas nem dispensa inspeção. A nota continua vindo apenas de avaliações registradas de porta-vozes. Prazo significa primeira submissão registrada até o dia solicitado, no calendário de Brasília; falta de prazo/data permanece identificada como desconhecida. O filtro de disponibilidade ignora ofertas expiradas, sem depender da próxima manutenção.

Links externos de portfólio seguem o consentimento existente. Não viram amostras de missão nem ganham uma garantia de revogação de conteúdo hospedado fora da Oficina. Esta entrega não adicionou uploads externos independentes, transcodificação ou cópias de thumbnails: a prévia usa o próprio asset autorizado.

## Aceite verificado

| Cenário | Evidência |
| --- | --- |
| Editor adiciona, edita e solicita amostra privada pela interface | [Estado pendente](editor-pendente.jpg) |
| Porta-voz confirma a declaração e publica a obra/versionamento | [Publicação](porta-voz-autorizada.jpg), [API e IDOR](publicacao-api.json) |
| Perfil móvel mostra vídeo válido, especialidades, 4,0/1 e selo independente | [Perfil de 390 px](perfil-mobile-publicado.jpg); vídeo: duração 4 s, instante 1 s, `readyState=4`, sem erro e sem overflow horizontal |
| Porta-voz consulta portfólio, envia convite e editor aceita pelo celular | db-43 → editor 86; [Convite](convite-mobile.jpg), [Aceite e bancada](aceite-mobile.jpg) |
| Editor iniciante aparece sem selo, estrelas ou portfólio inventados e recebe convite | db-44 → editor 87; [API de convite e aceite](convite-iniciante-api.json) |
| Porta-voz revoga; amostra sai da busca/perfil e URL anterior retorna 404 | [Revogação móvel](revogacao-mobile.jpg), [Perfil sem amostra](perfil-mobile-revogado.jpg), [API](revogacao-api.json) |
| Editor retira a amostra e salva preferência de trabalho na interface | Estado final privado, revisão 8; [Preferência salva](preferencias-editor.jpg), [D1](evidencia-d1.json) |
| Habilitação administrativa ocorre pela interface | [Painel do inspetor](habilitacao-administrativa.jpg); concessão/revogação também cobertas por testes |
| Retries e concorrência não duplicam obras nem substituem uma revogação | [Criação idempotente, 200/409 e autorização antiga rejeitada](concorrencia-api.json) |
| Arquivo original, versões, auditoria e atribuições preservados | db-42 finalizada, versão 1, arquivo 382.376 bytes; db-43 e db-44 com uma atribuição ativa cada; `foreign_key_check=[]` no [D1](evidencia-d1.json) |

A amostra final ficou **privada**, com os consentimentos revogados. Os testes não publicaram material de campanhas reais. Missões anteriores db-38/db-39/db-41 foram preservadas.

## Verificação e commits

- `973d6f9`: gestão/publicação/revogação por obra, armazenamento existente, integração com diretório, preferências, habilitação e métricas.
- `4a81168`: disponibilidade correta após expiração de ofertas e ajuste de apresentação.
- `f4103c8`: validação do tipo da preferência na fronteira HTTP.
- Regressão completa: **293 testes passaram** (6 config, 66 domínio, 150 D1/banco, 4 e-mail, 49 API, 18 web). A validação adicional de tipo passou no teste focado depois da regressão; total de casos permanece 293.
- 16 testes direcionados de portfólio/diretório/seleção passaram, além dos testes de mídia privada na primeira integração.
- Typecheck do monorepo e typecheck final da API passaram. Build de staging concluído. Biome passou nos **21 arquivos de código** desta entrega; `git diff --check` passou.
- O Biome global encontrou **16 erros preexistentes** de formatação/importação em arquivos fora desta entrega. Não foi apresentado como aprovação global. Esses arquivos e o documento paralelo `docs/EXTRACAO-MARKETPLACES.md` foram preservados.
- PostgreSQL legado não executado: sem `TEST_DATABASE_URL`. O portfólio usa D1; sem esse binding, responde 503, como o diretório existente. Imagens tiveram validação de permissão/MIME automatizada; a jornada visual em staging utilizou vídeo sintético.

As migrações `0016` e `0017` foram aplicadas somente a `oficina-amarela-staging`, na conta casamarela. Workers finais e resultados dos checks estão em [verificacao.json](verificacao.json).

Próxima fatia executável: onboarding por papel e jornada de inspeção — entrada do editor iniciante/experiente, responsabilidades do porta-voz/editor/inspetor e fila de entregas que precisam de fiscalização. Reutilizar ONCA-4/ONCA-53; percentual de amostragem e critérios de risco continuam decisões próprias, sem inventá-los. Pagamentos e a reforma visual ONCA-11 continuam separados.

## Registro no Jira

Comentários salvos e status **Done** confirmados no Jira oficial em [ONCA-34](https://oficinaamarela.atlassian.net/browse/ONCA-34) e [ONCA-61](https://oficinaamarela.atlassian.net/browse/ONCA-61). Evidências: [ONCA-34 Done](jira-onca-34-done.jpg), [ONCA-61 Done](jira-onca-61-done.jpg), [comentário ONCA-34](jira-onca-34-comment.txt) e [comentário ONCA-61](jira-onca-61-comment.txt). Os itens ONCA-105/106/107/108 permanecem pós-MVP e não foram encerrados. ONCA-4 e ONCA-53 conservam seus próprios critérios.
