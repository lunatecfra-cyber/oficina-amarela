# ONCA-62 — mural até atribuição exclusiva

Aceite técnico validado em staging em 13/10/2026. Código: `4fe7ae2`, `6d3f1d6`, `2ffe421`, `396d85b`, `c735ffe`, `d8981f5`, `349f178`.

## Ensaio real

Missão `db-39`, criada pelo porta-voz sintético 84 pela interface. A (50, `ed.j1788179332361`) e B (85, `board.20261013.b`) abriram o mural e registraram interesse. A missão permaneceu disponível sem atribuição. O porta-voz comparou ambos e consultou os perfis: A com avaliação real 4,0/1, B sem avaliações/portfólio. Selecionou B; B recebeu e aceitou a oferta pelo site e chegou à bancada com upload, entrega e conversa existentes. D1 confirmou dois interesses, uma oferta aceita e uma atribuição ativa para B. A não tem oferta ou ação para tomar a missão.

O prazo desejado é opcional no formulário existente; esta fixture terminou sem prazo definido. Os testes de persistência cobrem o campo quando informado. Fonte sintética/referência pública; nenhum material real de campanha foi enviado.

Ensaio móvel Chromium 390×844: A vê missão indisponível, sem botão de interesse/apropriação; porta-voz vê aceite de B persistido. Largura de documento = 390 px nas duas telas. Screenshots e asserts preservados. `mobile-check.mjs` usa o playwright-core já instalado no ambiente, Chrome e `OFICINA_STAGING_PASSWORD` para as fixtures autorizadas; não contém senha. Ele verifica o estado persistido da missão 39, sem criar missões nem alterar atribuições.

## Regras e verificações

- 281 testes de regressão passaram; 25 testes direcionados inicialmente e 13 de fila/recuperação no fechamento. Typecheck e Biome dos arquivos alterados passaram.
- Interesse não reserva; unicidade e triggers protegem concorrência. Seleção requer dono, editor elegível e interesse ou convite direto; aceite reutiliza motor existente.
- Novas publicações D1 são manuais; missões legadas continuam com comportamento anterior. Nenhum opt-in automático foi inventado.
- Recusa/expiração reabrem escolha para outro editor; contrato existente não permite novo convite ao mesmo editor na mesma missão. Não foi introduzida retirada de interesse.
- Mural/projeções gerais omitem anexos, links privados e identificação de campanha. Oferta concede os dados de trabalho ao selecionado.
- Dois eventos de interesse e aceite: e-mail simulado. Evento de oferta existe no site; e-mail ainda pendente foi cancelado ao aceitar, evitando aviso obsoleto. `evidencia-d1.json` contém entrega por chave exata, atores e FK sem violações.
- Login sem JavaScript: método POST, campos/botão desabilitados; só libera depois de hidratar. Ensaio adicional registrado em `login-hydration.log`.

## Publicação e limites

API staging: `b4fda50e-7eb8-4ebe-94b3-8e00325f8658`. Web staging: `46e4fc6f-5227-4e36-8e75-594efd8d69c2`. D1 staging `b667d137-ff01-41a5-bd57-bb3399e9cc5a`, migração 0014 aplicada. R2/filas seguem staging; provedor de e-mail simulado. Checkout de publicação isolou alterações não commitadas; Lucide é a dependência já commitada pelo trabalho anterior de interface.

Não houve alteração de produção, pagamento ou envio externo real. PostgreSQL não foi testado; mural retorna 503 nesse ambiente. Fixtures preservadas. Amostragem/risco de inspeção continuam decisões pendentes do ciclo anterior.

O Jira oficial foi lido e atualizado na conta Hotmail após recuperar a conexão: comentário salvo e ONCA-62 **Done**; ONCA-61 em andamento com progresso salvo; ONCA-53 e ONCA-120 receberam as novas evidências e permaneceram em andamento. Screenshots de confirmação incluídos. `jira-comment.txt` preserva o texto da ONCA-62.

## Continuação entregue — primeira fatia ONCA-61

Commits `2edb654`, `16b0e60` e correções subsequentes: diretório autenticado com publicação explicitamente autorizada pelo editor, busca por nome/apelido e especialidade/nicho, filtro de elegibilidade atual, contagem de trabalhos finalizados e média/amostra de avaliações reais. Permissão para publicar o perfil é separada da divulgação do link de portfólio. Nenhuma obra privada da plataforma é publicada por essas opções; links privados/assinados são omitidos. O endpoint antigo de perfil fica restrito ao próprio editor/admin; consultas de terceiros usam a projeção publicada ou a relação de missão do porta-voz, sem contatos ou histórico privado.

O diretório começou vazio. A autorizou publicação pela interface, mantendo o consentimento de portfólio desligado. O porta-voz encontrou A na busca móvel com 4,0/1 e dois trabalhos concluídos; B permaneceu fora do diretório por não autorizar publicação. A partir do diretório, a nova missão `db-41` recebeu convite direto e aceite por A via interface, chegando à bancada de produção. `db-39` permanece atribuída somente a B. `db-40` conserva a tentativa anterior expirada (prazo desejado persistido em 01/11/2026), que expôs o uso indevido de presença antiga em ofertas explícitas. A correção mantém o prazo existente de cinco minutos para selecionados; expiração antecipada por ausência permanece apenas no despacho automático legado.

`diretorio-evidencia-d1.json` confirma uma atribuição ativa em cada missão (39→85, 41→50), visibilidade autorizada de A/privada de B, auditoria do consentimento e FK sem violações. As screenshots mostram o diretório móvel e o convite/aceite direto. O primeiro ensaio automático confirmou privacidade/publicação/busca; o convite completo foi concluído pelo Chrome interativo após corrigir a expiração, sem contar a tentativa anterior como sucesso.

Regressão final do checkout isolado: **283 testes**, zero falhas; typecheck com 9 tarefas passou. 18 direcionados da integração, proteção de links e 14 de fila/recuperação passaram. API final de staging `982bf9e4-1eb8-43ab-a556-5d76b3d08370`; web final registrada abaixo. Migração 0015 aplicada apenas ao staging. Mudanças paralelas não commitadas continuam preservadas e fora da publicação.

ONCA-61 ainda não está concluída: faltam publicação/revogação por obra com autorização específica, habilitação administrativa de editor experiente e selo derivado dela, preferências voluntário/remunerado e indicador de entregas no prazo com proveniência. Não foram inventadas notas, selos ou permissões de divulgação de vídeos. Próxima fatia executável: autorização e publicação de amostras por obra, articulada à ONCA-34.


Web final de staging: `e8945c6c-a748-48b8-8a37-2b0e522e05c2`.
