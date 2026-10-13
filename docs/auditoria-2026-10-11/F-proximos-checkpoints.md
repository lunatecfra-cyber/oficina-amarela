# F. Próximos Checkpoints

Sem estimativas em horas: esforço indicado só como complexidade observada (P/M/G) ou **pendente**. Nenhum ticket foi criado.

## Checkpoint 0 — Higiene de segurança e paridade (primeiro, recomendado)
Menor conjunto com melhoria verificável sem mudar produto:
1. **Fechar C-01**: `/auth/google/find` deve receber prova verificável (ID token validado ou chamada só via Service Binding com segredo interno) e **não** vincular `google_id` por e-mail sem prova. *Complexidade: P.*
2. **Fechar C-02**: servidor define `max/window/lock`; `key` derivada de IP/conta no servidor, não do corpo. *P.*
3. **C-04**: configurar provedor de e-mail (ou usar o Email Service da Cloudflare, já com binding no `mail`) e fazer `deliverEmail` **falhar** quando sem provedor, em vez de retornar `true`. *P.*
4. **C-05**: sincronizar checkout com o bundle remoto antes de qualquer deploy (diff do worker implantado × `main`). *M.*
5. Desligar `workers.dev` da API (ou proteger com segredo) após confirmar que o web usa só o Service Binding. *P.*

**Aceite:** testes novos reproduzem C-01/C-02/C-04 e passam; sondas de `audit-probes.ts` passam a falhar como esperado; e-mail de teste chega a caixa real em **staging**; API pública sem `workers.dev` responde 404; `bun test`/typecheck verdes.
**Validação:** staging primeiro, contas sintéticas; depois produção com aprovação humana. **Dependências:** acesso a segredos Cloudflare, decisão do provedor.

## Checkpoint 1 — Rede de segurança de engenharia
CI (typecheck, testes, Biome), lint limpo (conferir sem o hook RTK), ledger de migrations (`schema_migrations`) com comparação schema × arquivos, backup/restore ensaiado em staging, alertas (Queue DLQ, erro 5xx, Cron). *M.* Aceite: pipeline vermelho bloqueia merge; restore comprovado; runbook de rollback em `docs/`.

## Checkpoint 2 — Documentação canônica
Atualizar `AI_HANDOFF.md`/`INFRA.md` com o estado real (arquivar docs Supabase/mock). *P.*

## Checkpoint 3 — Fundação de comunidade (sem dinheiro)
Perfil público de editor com opt-in + portfólio + especialidades (`editor_specialties`), diretório. Depende de E-08 (LGPD). Aceite: editor edita perfil, só campos públicos expostos, testes de visibilidade por papel. *M.*

## Checkpoint 4 — Modos de serviço e prazos (gratuito)
`service_type`, `complexity`, `due_at`, `revision_limit`; limite de 4 solicitações/mês; reputação de serviço separada (E-02/E-03). Depende de decisões de negócio 11, 13, 16.

## Checkpoint 5 — Mural híbrido
Depende de CP0–CP1 e de testes de concorrência remotos (`testar-concorrencia-remoto.mjs` adaptado). Aceite: N reservas simultâneas → exatamente 1 vencedor; elegibilidade aplicada no servidor.

## Checkpoint 6 — Pagamentos
**Bloqueado** por parecer jurídico/tributário/eleitoral e escolha de PSP. Esforço: **pendente**.

## Backlog preliminar (para comparar com o Jira — nada criado)
| ID prelim. | Item | Origem | CP |
|---|---|---|---|
| B-01 | Verificar posse do Google ID no vínculo | C-01 | 0 |
| B-02 | Rate limit server-side | C-02 | 0 |
| B-03 | Provedor de e-mail + falha explícita | C-04 | 0 |
| B-04 | Paridade checkout × worker remoto | C-05 | 0 |
| B-05 | Controle de acesso em `missions/view` e rota pública de candidato | C-03 | 0/1 |
| B-06 | CI + lint verde | C-06 | 1 |
| B-07 | Ledger de migrations | C-07 | 1 |
| B-08 | Backup/restore ensaiado | C-11 | 1 |
| B-09 | Atualizar documentação canônica | C-13 | 2 |
| B-10 | Perfil público/portfólio/especialidades | D-1..3 | 3 |
| B-11 | Tipos de serviço, prazos, revisões | D-6..9 | 4 |
| B-12 | Mural híbrido | E-01 | 5 |

## Etapa H — Jira (não realizada)
Sem URL, chave de projeto nem credenciais; o conector Atlassian não está autenticado. Para concluir: informar URL e chave, autenticar o conector (somente leitura). Produzirei então: entregas no Jira sem código, código sem Jira, obsoletos, e a comparação com o backlog acima.
