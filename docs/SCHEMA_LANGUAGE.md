# Idioma do schema — decisão e como ela foi executada

**Status:** decidido em 2026-08-31, em execução.
**Vale para:** `infra/cloudflare-scale` e tudo que sair dela.

## A regra

Identificador fica em **inglês**. Isso inclui, sem exceção:

- variável, função, tipo, arquivo;
- **nome de tabela e de coluna**;
- chave de JSON gravado ou trafegado;
- classe de CSS e propriedade CSS customizada;
- valor de union literal usado como identificador no código (`"coming_soon"`,
  nunca `"em-breve"`).

**PT-BR** fica só no que uma pessoa lê: texto da aplicação, mensagem de erro ao
usuário, saída de terminal, comentário, nome de teste (`describe`/`test`),
documentação, README, mensagem de commit e opção de linha de comando que o
operador digita (`--origem`, `--destino`).

## O que mudou nesta decisão

A regra já valia para código. O que mudou em 31/08 foi passar a valer também
para **o que já existia no banco**. Até então a orientação era não renomear
schema por motivo cosmético, e o resultado foi um banco inteiro em português
com colunas novas em inglês pingando no meio — o pior dos dois mundos, porque
ninguém consegue adivinhar de que lado uma coluna está sem ir olhar.

São 21 tabelas e 217 colunas conferidas: 19 tabelas e ~130 colunas mudam de
nome.

## O de-para

A fonte da verdade é `packages/db/src/migration/legacy-names.ts`. Ele não é
documentação: é o módulo de onde saem as migrações de renomeação e a tradução
da carga PostgreSQL → D1. Nada de nome antigo/novo deve ser digitado à mão em
outro lugar.

Os nomes novos não foram inventados. São os que o TypeScript já usava do outro
lado da fronteira (`campaignTaxId`, `voterId`, `avatarUrl`, `deliveredCount`),
então o banco passa a falar a mesma língua que o domínio e a camada de tradução
dentro dos repositórios encolhe em vez de crescer.

## O que NÃO muda, e por quê

**Valor de linha.** `status = 'disponivel'`, `papel = 'voz'`,
`formato = 'longo'` são dado, não identificador. Renomear exigiria reescrever
todas as linhas e as restrições `CHECK` junto, e o domínio já normaliza as duas
grafias na fronteira (`case "available": case "disponivel":`). Fica como está.

**O Supabase em produção.** Ele NÃO é renomeado. É o banco que atende a
aplicação no ar hoje, no Vercel, com o código antigo: renomear coluna ali
derruba o site em produção. Ele continua em português até ser desligado.

Isso é o que torna a decisão segura, e é o detalhe que mais importa para quem
pegar isso depois: **a tradução acontece na passagem**, não no banco de origem.
A carga PostgreSQL → D1 lê nomes antigos e escreve nomes novos, usando o
de-para. Nenhuma migração precisa ser aplicada no Supabase para a migração
funcionar.

## Ordem de execução

1. `legacy-names.ts` — o de-para, com conferência de cobertura contra o schema.
2. Migrações de renomeação, **geradas** a partir do de-para:
   - PostgreSQL: `supabase/migrations/20260901_rename_to_english.sql`
   - D1: `packages/db/d1/0003_rename_to_english.sql`
   As duas são idempotentes: `ALTER TABLE ... RENAME` que já aconteceu falha com
   "não existe", e o aplicador trata isso como já aplicado.
3. Código: todo SQL e todo tipo de linha em `packages/db` passa a usar os nomes
   novos.
4. Carga PostgreSQL → D1: traduz origem legada → destino novo.
5. Bancos: o de testes e os dois D1 (staging e produção) são renomeados. O
   Supabase de produção, não.

## Como conferir que não sobrou nada

```bash
npm test --workspace @oficina/db      # inclui a conferência de cobertura do de-para
node scripts/migrar-para-d1.mjs --origem <postgres legado> --destino ./ensaio --a-seco
```

A conferência de vocabulário (`migration-vocabulary.test.ts`) cobra que nenhuma
migração toque tabela que o schema não tem, e a de cobertura
(`legacy-names.test.ts`) cobra que nenhuma coluna PT-BR do schema tenha ficado
sem de-para.

## O que quem pegar isso precisa saber

- Coluna nova entra em inglês direto, sem passar pelo de-para.
- O de-para é histórico: ele existe enquanto existir um banco legado para ler.
  Quando o Supabase for desligado, `legacy-names.ts` e a tradução na carga
  podem ir junto.
- Se aparecer uma coluna em português no schema, a conferência de cobertura
  falha. É proposital: ou ela entra no de-para, ou ela não deveria existir.
