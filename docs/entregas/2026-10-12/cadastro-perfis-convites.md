# Cadastro, perfis e convites — execução de 12/10/2026

Meta de negócio: 16/10. Status: jornada funcional registrada abaixo concluída
em staging; reconciliação dos critérios oficiais no Jira ONCA ainda indisponível.

## Entregue

| Commit | Correção |
| --- | --- |
| `80ca6ca` | API exige identidade Google assinada e com validade, emitida após o callback OAuth; os dois chamadores web foram atualizados. Inclui jornada HTTP com D1 isolado. |
| `5138628` | Rotas auxiliares de limite exigem sessão, usam apenas o contador de upload do próprio usuário e limites fixos no servidor. Remove helpers sem uso e atualiza o upload. |
| `404f4d2` | E-mail sem configuração válida retorna falha, preservando o estado de entrega da fila. Não recupera mensagens anteriormente marcadas como enviadas. |
| `20a3ef4` | Painel de convites lê `expiresAt` retornado pela API e exibe a validade. |

Cadastro por senha, convites, perfis e controles de administrador já existiam.
Os papéis editor, porta-voz e admin foram preservados; não foi criado outro
fluxo de autorização para inspetores.

## Evidência local

- 249 testes executados passaram, sem falhas, no checkout limpo com lockfile
  original. Suítes PostgreSQL foram puladas por ausência de `TEST_DATABASE_URL`.
- Typecheck passou no checkout de trabalho e no checkout limpo usado no deploy.
- Biome passou nos arquivos alterados; `git diff --check` passou.
- Jornada D1: emissão administrativa, cadastro, sessão, perfil completo,
  conferência administrativa, acesso por papel, reutilização recusada,
  expiração, revogação, e-mail incorreto e recuperação após conflito de apelido.
- Google: assinatura adulterada, token ausente ou expirado, campos forjados,
  papéis indevidos, vínculo por e-mail e conta banida.
- Editor: cadastro público, perfil, login por senha e limites administrativos.
- E-mail: teste impede chamadas de rede e confirma falha sem provedor.

Reprodução, na raiz do repositório:

```sh
bun install --frozen-lockfile
cd packages/db
node --test src/d1/registration-journey.test.ts
cd ../..
bun run test
bun run typecheck
```

## Staging

Alvo: https://oficina-amarela-web-staging.casamarela.workers.dev

- API: versão `4fca8eb2-bade-470c-abef-9fe1376a923b`.
- Web: versão `d397afaa-800a-4f94-95ae-e2aca21bdb38`.
- Checkout isolado: base `404f4d2` mais a mesma correção de `20a3ef4`;
  alterações anteriores de dependências e documentação não foram publicadas.
- D1 staging `b667d137-ff01-41a5-bd57-bb3399e9cc5a`, distinto do D1 de
  produção; Service Binding e fila apontam para staging. Esquema foi consultado
  sem aplicar migrações. Não houve deploy nem escrita em produção.
- Chrome: login do inspetor sintético, acesso à administração, emissão de
  convite para `example.invalid` e exibição da validade em 19/10 foram verificados.
- [Evidência do convite](convite-staging.jpg).
- [Formulário preparado](cadastro-pendente-staging.jpg), sem clicar no aceite.

## Retomada e aceite funcional

O usuário autorizou explicitamente o aceite dos termos apenas para
`qs.1791818566.v@example.invalid` em staging. Pela interface foram concluídos
cadastro por convite, as três etapas do onboarding, conferência administrativa
do perfil completo e novo login por senha. [Perfil conferido](perfil-conferido-staging.jpg).

A conferência revelou `Invalid Date`: `users.created_at` em staging é nullable
e não tem DEFAULT. A migração `0008_user_created_at.sql`, aplicada somente em
staging, data novas inserções sem preencher datas históricas desconhecidas.
A API passa a devolver campo vazio para essas datas; a interface foi reconferida.
O teste reproduz essa diferença de esquema e a reaplicação idempotente do patch.
Os testes D1 agora descobrem todas as migrações, incluindo atribuições de missão.

Verificação final: **253 testes aprovados**, typecheck de todos os workspaces,
Biome nos seis arquivos TypeScript alterados e `git diff --check` aprovados.
As suítes PostgreSQL continuam sem execução: o fallback ainda existe no código
e em desenvolvimento local; staging e produção configuram o binding D1 e
selecionam todos os repositórios D1. A ausência de PostgreSQL não bloqueia este
aceite D1 e não constitui validação daquele adaptador.

API staging final: `c92bfc9b-52de-4c1e-aea9-a7608f2477c7` (inclui as correções
de acesso a missões descritas no [ciclo seguinte](missoes-atribuicao.md)).
Web permanece na versão já registrada acima. Publicações usaram o checkout
isolado anterior, com somente as correções de código copiadas; as alterações
preexistentes de dependências, portas e auditoria foram preservadas.

Fixtures em staging: inspetor `qs.1791818566.a` (id 83), porta-voz
`qs.1791818566.v` (id 84), seu convite consumido e sua missão sintética.
Limpeza depende de aprovação específica para exclusão externa; preservar
todos os demais dados.

A sondagem HTTP recebeu bloqueio Cloudflare 1010 antes da aplicação. Não houve
tentativa de enfraquecer a proteção. A validação publicada seguiu pelo Chrome.
Google OAuth real e entrega real de e-mail não foram executados.

O Jira oficial ONCA foi rechecado nesta retomada e redirecionou para verificação de e-mail e solicitação de
acesso da conta conectada. Nenhuma issue foi lida, criada ou alterada. Não foi
usado o Jira pessoal. Não atribuir aceite nem status Done sem reconciliar ONCA.

O desenvolvimento já seguiu para a meta de 23/10: solicitações de vídeo e atribuição.
