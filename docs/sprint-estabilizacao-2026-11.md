# Estabilização — registro de trabalho

## Estado em 27/10/2026

- Base local: `b96daeb`. Alterações locais anteriores em configuração e aulas foram preservadas; nenhum arquivo da home foi alterado.
- Mural: interesse, escolha e oferta já existem. A exclusividade continua nas rotas e no banco; a interface agora permite busca por título ou porta-voz e filtro por formato. O mural existente é de trabalhos gratuitos, não de pagamentos.
- Perfil: o gerenciador existente de amostras foi integrado ao perfil do editor. O menu do editor deixou de mostrar Agenda, Ranking e Portfólio; as rotas continuam disponíveis. A moderação de portfólio e o acesso dos demais papéis foram preservados.
- Foto: o formulário completo já comprime e envia a imagem ao perfil, e o perfil usa iniciais como alternativa. A validação compartilhada agora exige base64 válido, limite de tamanho e assinatura compatível com PNG, JPEG, GIF ou WebP; isso não substitui uma decodificação completa do arquivo. Os testes de perfil D1 e da validação passaram. Falta validar armazenamento, autorização e jornada de upload em ambiente realista.
- Parceiros continua sendo uma página com links nos cabeçalhos; a sidebar solicitada ainda não foi implementada.
- Ofertas: a interface exige abrir as ofertas. Respostas sem confirmação agora destravam os controles, atualizam o estado e exibem aviso; erros de consulta também são exibidos. No navegador local, uma falha de rede simulada ao aceitar mostrou o aviso, reabilitou o botão e não repetiu o POST. A jornada com oferta real e as condições de corrida na interface ainda precisam de teste.
- Videoaulas: em staging, uma conta sintética persistida no D1 fez login pela API real (200) e acessou `/api/lessons` e `/aulas` (200). A conta foi desativada em seguida. Em Next local, `DATABASE_STUB=1` não contém a conta sintética do atalho e a revalidação da API devolve 401; a rota de aulas também exige D1, ausente no `next dev` em processo.

## Migração de contas

O ensaio existente em `scripts/migrar-para-d1.mjs` e `packages/db/src/migration/pg-to-d1.ts` mapeia PostgreSQL legado para D1, incluindo usuários, missões, avaliações e portfólio. Ele não demonstra reconciliação segura entre contas já existentes: `INSERT OR IGNORE` não prova identidade nem resolve colisões. `scripts/migrar-dados-anteriores.mjs` é backfill de gamificação, não migração de contas.

Ainda é necessário identificar a origem efetiva e sua autoridade, comparar identidades e vínculos com o destino, decidir conflitos e credenciais, produzir relatório de duplicados/pendências e testar recuperação e idempotência com dados representativos isolados. Nenhuma migração de dados reais foi executada.

## Tickets e validação

Os registros existentes relacionam o mural a ONCA-62, portfólio a ONCA-61/34, navegação a ONCA-60 e homologação ampla a ONCA-120; esses registros são históricos, não uma consulta atual ao Jira. No GitHub existem issues de perfil (#6) e revisão geral (#14). Nenhum ticket foi criado ou alterado.

Typecheck global e testes automatizados passaram; testes dependentes de `TEST_DATABASE_URL` foram pulados. Biome dos arquivos desta fatia passou; lint global encontrou 17 erros em outros arquivos. Ainda faltam testes de navegador por papel, responsividade e jornadas E2E com dados reais de teste.

Staging web está na versão `d24754c1-fbb0-4c54-b81a-40dce3311dea`, publicada em 27/10 sem tag ou commit identificável. Não foi substituída: a proveniência precisa ser reconciliada com o trabalho em andamento antes de um deploy que poderia sobrescrevê-la. Produção não foi alterada.

Na primeira jornada móvel de staging, os quatro papéis autenticaram e passaram pelo onboarding, diretório, criação de missão, convite e aceite. A etapa seguinte expirou ao navegar para `/porta-voz/missao/db-86`: a resposta do documento foi 200 em cerca de um segundo, mas o teste aguardava `networkidle`. O ensaio foi ajustado para `domcontentloaded` e repetido; as quatro contas da primeira execução foram verificadas como desativadas. A missão sintética db-86 permanece no staging. Dois alertas de alvos de toque apontaram para inputs `sr-only` e precisam de triagem manual antes de classificá-los como defeitos reais.

Na segunda execução, a conversa privada também passou. O teste parou antes do upload porque havia dois campos de arquivo e o seletor genérico era ambíguo; ele foi restringido ao campo de vídeo e uma nova execução foi iniciada. As quatro contas dessa tentativa foram verificadas como desativadas. Nenhuma dessas execuções testa as alterações locais ainda não publicadas.

A terceira execução móvel concluiu a jornada funcional inteira, incluindo duas entregas, reedição, inspeção, aprovação, avaliação, denúncia, retenção e revogação. As quatro contas foram verificadas como desativadas. O relatório registrou 8 erros de alvo de toque no mesmo input de arquivo `sr-only`, 14 alertas de acessibilidade/contraste e 3 erros de hidratação React em denúncias. O verificador foi corrigido para medir o label visível do campo de arquivo; o resultado ainda precisa ser repetido. Datas de denúncias agora usam fuso explícito `America/Sao_Paulo`, causa provável da diferença entre SSR e navegador; um teste comparou o resultado do servidor em UTC com o navegador em outro fuso, mas o erro de hidratação ainda precisa ser reavaliado após publicação das mudanças. O campo de confirmação de exclusão também recebeu nome acessível. Restam os alertas de contraste.

A mesma jornada desktop concluiu 44 verificações funcionais, sem erro de alvo de toque reportado após o ajuste do auditor, com 14 avisos e os mesmos 3 erros React em denúncias. As quatro contas sintéticas foram verificadas como desativadas. Os vídeos, missões e eventos sintéticos permanecem em staging; não houve publicação das alterações locais nem validação visual delas.
