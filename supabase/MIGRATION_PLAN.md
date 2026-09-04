# Plano de migrations pendentes

Nenhuma migration deste plano foi aplicada ao banco real.

## Bloqueio obrigatorio

Antes de executar qualquer arquivo, confirmar qual schema existe em producao:

```sql
SELECT
  to_regclass('public.users') AS users,
  to_regclass('public.missions') AS missions,
  to_regclass('public.pautas') AS pautas,
  to_regclass('public.avaliacoes') AS avaliacoes;
```

O backend principal usa `missions` e colunas em ingles. A migration eleitoral e
`lib/electoral-ranking-db.ts` usam `pautas`, `avaliacoes` e colunas em portugues.
`20260829_add_electoral_ranking.sql` nao pode ser executada se `pautas` nao for
o schema real.

## Mapa de divergencias

| Canonico em ingles | Legado em portugues |
| --- | --- |
| `missions` | `pautas` |
| `reviews` | `avaliacoes` |
| `handle`, `name`, `role` | `apelido`, `nome`, `papel` |
| `reserved_by_id` | `reservada_por_id` |
| `is_scored` | `pontuada` |
| `delivered_count` | `entregues` |
| `reputation`, `rating` | `reputacao`, `nota` |
| `referred_by_id` | `indicado_por_id` |
| `referral_code` | `codigo_indicacao` |
| `candidate_number` | `numero_eleitoral` |

Os valores de status tambem divergem, por exemplo `in_review`/`em_revisao`,
`approved`/`aprovada` e `completed`/`finalizada`.

Nao manter um schema hibrido. Se producao for o legado em portugues, os modulos
`lib/missions-db.ts` e `lib/candidate-db.ts` precisam de adaptacao ou de uma
migration completa para o canonico. Se producao for o canonico em ingles,
`lib/electoral-ranking-db.ts` e `20260829_add_electoral_ranking.sql` precisam ser
convertidos antes da execucao.

## Ordem candidata para o schema legado em portugues

1. `20260818_add_r2_and_compliance_columns.sql`
2. `20260818_add_r2_and_tse_columns.sql`
3. `20260827_add_gamification_events.sql`
4. `20260829_add_electoral_ranking.sql`
5. `20260830_add_candidate_number.sql`

Os dois arquivos de 18/08 sao duplicados. Ambos usam `IF NOT EXISTS`, entao a
segunda execucao e redundante, mas nao deve alterar dados. A migration de 29/08
tambem inclui as mesmas colunas e depende de `users`, `pautas` e `avaliacoes`.

## Validacao antes da aplicacao

- Fazer backup e registrar a contagem de `users`, missoes/pautas e avaliacoes.
- Executar primeiro em uma copia do banco.
- Confirmar que todas as funcoes em `oficina_private` compilam.
- Testar convite de porta-voz, aprovacao e anulacao de uma edicao.
- Confirmar que cada edicao pontua uma vez.
- Confirmar `candidate_number` no perfil e na missao.
- Confirmar reversao de ranking, constancia e indicacao.
- So aplicar em producao depois de decidir Neon intermediario versus D1 direto.

## Resultado esperado

A ordem so fica liberada depois que o schema real for confirmado e a divergencia
entre `missions` e `pautas` for resolvida. Ate la, o estado e `BLOQUEADO`.
