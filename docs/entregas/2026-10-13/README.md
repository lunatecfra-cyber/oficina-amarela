# Ciclo sintético validado em staging — 13/10/2026

Missão `db-38`: criada e aceita pela interface; editor `50`, porta-voz `84`, fiscal autorizado `83`. Quatro uploads MP4 reais no R2 privado de staging; ajuste do porta-voz na versão 1, fiscalização solicitando correções nas versões 2/3, aprovação independente da versão 4 e encerramento pelo porta-voz. D1 confirma `finalizada`, versão `4`, inspeção obrigatória aprovada e atribuição encerrada. O editor recebeu a notificação final na interface. Dados e material exclusivamente sintéticos.

Evidências: [missão finalizada](missao-finalizada-staging.jpg), [notificação do editor](editor-notificacao-final-staging.jpg), [vídeo final](video-v4-staging.jpg), [marca vertical na lateral direita](marca-vertical-staging.jpg) e [consulta D1](evidencia-d1.json). A orientação da marca é branca/discreta, lateral direita, leitura de baixo para cima; sua conferência foi visual, sem transcodificação automática.

Regressão: 273 testes; checkout isolado: 27 testes direcionados; última correção: 7 testes D1/R2, typecheck e Biome aprovados. PostgreSQL legado não exercitado (sem `TEST_DATABASE_URL`); staging usa D1.

Commits: `356fc48`, `991a8f8`, `380345c`, `402d842`, `8dc16d8`, `609e4d3`, `86ba37a`, `32812ea`. Últimas versões publicadas: API `42a52dde-056a-466d-a1d1-1892a1d364f7`, web `fcd1c8f2-75ff-41cb-b018-19839b65a5ed`; fontes do checkout isolado extraídas dos commits, preservando alterações locais de terceiros. Produção não alterada.

31 registros de e-mail do novo ciclo processados exclusivamente pelo provedor simulado; recuperação de falhas preservou backoff/tentativas. Um aviso de aceite antigo, anterior à implementação, continua esgotado com 5 tentativas. Nenhum envio real de e-mail, push ou WhatsApp. Os registros de auditoria sem autor legado continuam com autor desconhecido.

Jira oficial recuperado: comentários verificados em [ONCA-120](https://oficinaamarela.atlassian.net/browse/ONCA-120) e [ONCA-126](https://oficinaamarela.atlassian.net/browse/ONCA-126). O ciclo solicitado para 23/10 está validado; o aceite administrativo e os critérios V2 mais amplos do ONCA-120 continuam abertos.

Pendências de 30/10/V2: mural/interessados/seleção, identidade confiável do editor experiente convidado, papel de inspetor separado do administrador. Percentual de amostragem e critérios objetivos de criticidade/risco ainda não definidos; inspeção de todas as entregas é configuração exclusiva do ensaio de staging, não política definitiva de produção. As contas, versões e objetos do ensaio foram preservados para revisão, sem limpeza destrutiva.

## Avaliação real do porta-voz — ONCA-125

Implementada em `5641b4c` e `662e0d7`, publicada somente em staging. O porta-voz `84` atribuiu **4 estrelas** à versão `4` da missão `38` pela interface; o voto persistiu após recarregar, e o perfil do editor `50` exibiu **4,0 / 1 avaliação**. Antes do voto, a média era nula; a nota técnica e os registros antigos de origem desconhecida não entram na reputação pública. Não há nota automática após 48 horas.

Autorização, notas inválidas, serviço ainda não encerrado, versão antiga, votos concorrentes, retentativa, média e anulação administrativa auditada passaram nos testes D1/API. A anulação preserva o voto e impede substituí-lo; edição de voto não foi introduzida. A fiscalização continua registrando sua nota técnica separadamente, sem produzir estrelas públicas.

Evidências: [voto persistido](avaliacao-porta-voz-staging.jpg), [média e amostra](media-avaliacao-editor-staging.jpg), [D1 e auditoria](avaliacao-d1.json). Comentário de aceite técnico salvo e confirmado no [ONCA-125](https://oficinaamarela.atlassian.net/browse/ONCA-125); status administrativo do ticket preservado.

Verificação: **276 testes de regressão passaram** em checkout isolado; **27 testes direcionados**, typecheck e Biome aprovados. PostgreSQL não executado, sem `TEST_DATABASE_URL`; rota de avaliação retorna 503 nesse ambiente, sem alterar o contrato legado. Migration `0013` aplicada ao D1 staging; nenhuma violação de chave estrangeira antes/depois. API `06bc6f19-7cda-4c54-902c-eebc6a045a08`, web `840e4f4f-c32a-4e40-ad98-ae67b4975510`. Alterações paralelas de interface/dependências preservadas e excluídas desta publicação.

Próxima entrega executável: validar o mural/interesse/seleção pelo porta-voz nos critérios adicionais da ONCA-120. A conclusão do ciclo de missão não implica conclusão desses cenários V2 nem da versão completa de 30/10.
