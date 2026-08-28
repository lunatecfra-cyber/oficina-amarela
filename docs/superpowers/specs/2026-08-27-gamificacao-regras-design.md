# Sistema de Regras de Gamificacao

## Objetivo

Registrar progresso somente a partir de eventos reais do aplicativo, começando por entrada diaria e entrega de missao.

## Regras da etapa 1

| Regra | Evento que conclui | Referencia unica | XP |
| --- | --- | --- | ---: |
| Entrou no site | autenticacao concluida | data local em Brasilia | 10 |
| Entregou uma missao hoje | pauta muda para `em_revisao` | id da pauta | 40 |

Cada evento e idempotente. Uma segunda tentativa nao cria novo evento nem concede XP novamente.

## Fluxo

1. Uma rota de autenticacao confirma a identidade.
2. O motor grava o evento em `gamificacao_eventos` com chave unica.
3. Somente a primeira insercao atualiza `users.reputacao`.
4. A tela consulta as regras e os eventos do dia.
5. A interface mostra estado bloqueado, disponivel ou concluido; nao aceita conclusao arbitraria.

## Proximas regras

- Receber aprovacao: somente apos uma aprovacao valida do inspetor ou porta-voz.
- Manter sequencia: um evento de entrada em cada dia consecutivo, calculado no servidor.
- Primeiro envio da semana: primeira entrega valida no periodo semanal.

## Limites

XP e reputacao continuam sendo o mesmo saldo nesta primeira etapa, aproveitando o modelo existente. Conquistas e recompensas externas ficam para uma etapa posterior, depois de validar os eventos.
