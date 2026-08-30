# Banco de dados

## O que roda de verdade

`schema.sql` é o artefato operativo. Ele é inteiramente idempotente
(`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON
CONFLICT`) e pode ser aplicado quantas vezes for preciso:

```bash
DATABASE_URL="postgres://..." node scripts/migrar.mjs
```

Isso cria tabelas e índices que faltarem — inclusive num banco que já existe.

## O que os arquivos em `migrations/` são

Registro das mudanças que `schema.sql` **não consegue expressar**: sobretudo
`ALTER TABLE ADD COLUMN` em tabelas que já existiam.

**Nenhum runner aplica esses arquivos.** `scripts/migrar.mjs` lê apenas
`schema.sql`. Rodar uma migração de coluna num banco antigo é manual, e o
arquivo existe para dizer exatamente o que rodar.

Migrações que só criam tabela ou índice ficam nos dois lugares: no arquivo,
como registro do que mudou e por quê, e em `schema.sql`, que é quem as aplica.

## Invariantes de concorrência

Cinco índices únicos carregam regra de negócio, não só desempenho:

| Índice | Garante |
|---|---|
| `idx_pautas_missao_ativa_por_editor` | um editor segura no máximo uma missão ativa |
| `idx_ofertas_missao_editor` | um editor vê cada missão no máximo uma vez |
| `idx_ofertas_pendente_por_missao` | uma missão tem no máximo uma oferta viva |
| `idx_ofertas_pendente_por_editor` | um editor tem no máximo uma oferta viva |
| `fila_emails.chave` | a mesma mensagem não é enviada duas vezes |

Sem eles, as checagens em código voltam a ser corridas — o que já aconteceu.
`apps/web/lib/mission-concurrency.test.ts` cobre os quatro primeiros contra um
PostgreSQL real.

**Aplicar num banco com dados sujos não é idempotente**: se já existir editor
com duas missões ativas, a criação do índice falha. Use

```bash
DATABASE_URL="postgres://..." node scripts/migrar-invariantes-concorrencia.mjs
```

que aponta as linhas em conflito e sai sem alterar nada. Decidir qual missão o
editor perde é decisão humana, não do script.

## Onde o banco mora

Ver `docs/INFRA.md`. Há uma contradição em aberto: o diretório se chama
`supabase/`, mas o `INFRA.md`, conferido contra produção, registra **Neon**.
Nenhuma biblioteca da Supabase está instalada — o código usa o driver
`postgres` puro e serve para os dois. Confirmar antes de qualquer migração de
dados (`P0-06` no board da migração).
