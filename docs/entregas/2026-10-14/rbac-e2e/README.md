# Inspetor, capacidades e aceite visual em staging

## Autorização entregue

- Papel `inspector` separado de `admin`: leitura e conversa de missão, inspeção, consulta de evidências e encaminhamento de denúncias.
- Decisão administrativa, contas, convites, ranking, conteúdo, filas e segurança exigem capacidades próprias. Liberação de retenção exige concessão explícita adicional.
- API consulta a conta e suas capacidades atuais em cada requisição. Mudança de papel, bloqueio e corte de sessão invalidam cookies antigos; revogação de capacidade vale na próxima operação.
- Gatilhos D1 protegem inspeção, decisão, encaminhamento e liberação. Participação anterior e transferência não permitem autoinspeção ou decisão em conflito de interesse.
- Frontend revalida sessão pela API via Service Binding. Proxy reconhece o papel de inspetor e evita o ciclo `/editor` → `/inspetor`.

## Migração e validação

`0019_inspector_rbac.sql` cobre bancos locais existentes. Staging já tinha a coluna de papel ampliada e duas regras de convites mais recentes; recebeu somente [staging-rbac.sql](./staging-rbac.sql), preservando essas regras. Contagens e chaves estrangeiras foram conferidas antes/depois. Não reaplicar esse patch em bancos já migrados.

Regressão: **300 testes passaram**, sem falhas. Typecheck, build de staging e teste do redirecionamento passaram.

API de staging: `8bd9ed9e-be77-43a0-ae38-0a1555a423ff`. Frontend após correção do proxy: `4df55119-1c4d-4940-b672-6f55f6167695`.

Durante o E2E houve publicação concorrente do checkout `/tmp/oficina-onboarding-rbac-20261014`, que já integra o RBAC com inspeção atribuída. Essa publicação foi preservada. O ensaio foi adaptado para assumir a inspeção e preencher o motivo obrigatório da decisão. O teste visual aplica-se à integração publicada, enquanto os 300 testes acima se referem a este checkout; não comprovam equivalência entre as duas árvores.

O E2E encontrou e corrigiu o rótulo da justificativa para inspetores (`isOpen`, sem exigir capacidade de decisão). A correção de uma linha foi aplicada nos dois checkouts. Frontend integrado com essa correção: `024b5d1a-cc69-44bb-9da8-72c45131aada`; API integrada observada: `9960a39d-3ebd-4764-81f3-b86574a030b6`.

O script `scripts/testar-rbac-ui-staging.mjs` usa Chromium isolado, contas sintéticas e destinos fixos de staging, com desktop 1440×1000 e mobile emulado 390×844. Perfis completos são pré-requisitos sintéticos; onboarding não faz parte deste aceite. Contas são bloqueadas e concessões de retenção removidas ao encerrar o ensaio. Registros de auditoria/evidências sintéticos permanecem para revisão.

Para repetir: instale Playwright e seu Chromium headless fora do repositório e execute `PLAYWRIGHT_MODULE=/caminho/node_modules/playwright node scripts/testar-rbac-ui-staging.mjs /caminho/das/evidencias`. O script requer `ffmpeg`, autenticação Wrangler e acesso ao D1 de staging. O aviso Biome sobre `PLAYWRIGHT_MODULE` é de cache Turborepo; este ensaio é executado diretamente, fora dele. O ensaio respeita os limites de cadastro; tentativas repetidas podem exigir aguardar o desbloqueio do IP.

## Preservação dos arquivos

As consultas R2 estão em [r2-lifecycle.txt](./r2-lifecycle.txt), [r2-lock.txt](./r2-lock.txt) e [r2-public-access.txt](./r2-public-access.txt). Há apenas aborto de multipart incompleto após sete dias, sem expiração de objetos concluídos; acesso `r2.dev` desativado. A busca no código não encontrou exclusão de objetos R2.

**Limite:** não há object lock. Operadores com credenciais Cloudflare ainda podem apagar objetos diretamente. Evidências D1 preservam URLs externas, mas não garantem a disponibilidade nem a imutabilidade dos bytes no Drive/YouTube. Essas referências não devem ser tratadas como arquivos sob custódia da plataforma.

Produção e pagamentos não foram alterados. PostgreSQL e dispositivos móveis físicos não foram validados.

## Execução final em staging (14/10/2026)

Código testado: `8929809` + correção da exclusão de conta (`9e1182e`, aplicada num worktree limpo, sem os commits de Videoaulas, que dependem da migração `0024` ainda não aplicada em staging). API `1a17b4e0-acb1-4648-ae43-229b3c6aca68`, frontend `30c7b9e6-e60d-44f4-b9c0-fbe4cc06ab85`. Produção não foi alterada; nada foi enviado com push.

| Camada | Resultado |
| --- | --- |
| Navegador (Chromium headless), desktop 1440×1000 e mobile 390×844 | PASS, 20 verificações em cada viewport |
| HTTP direto contra staging (`scripts/testar-moderacao-staging.mjs`) | PASS, 33 verificações |
| Suíte do repositório | 320 testes, 0 falhas, 0 pulados; typecheck sem erro |

A jornada do navegador cobre cadastro, atribuição, chat, entrega v1 e v2, reedição, inspeção sem `admin`, rota administrativa negada ao inspetor, aprovação e avaliação, denúncia, encaminhamento pelo inspetor com download da evidência, decisão auditada, exclusão de conta bloqueada por retenção, bytes v1 e v2 preservados, liberação de retenção, revogação de capacidade e de papel. O banco registrou as três auditorias esperadas (`denuncia_encaminhada`, `denuncia_decidida`, `retencao_denuncia_liberada`) e nenhuma violação de chave estrangeira. O inspetor não vê "Marcar resolvida" nem "Liberar retenção".

Remover `app/inspetor/denuncias/layout.tsx` não abre acesso: a API exige capacidade em todas as rotas `/admin/reports/*` e a lê do banco a cada requisição. O teste `rotas de denúncia recusam anônimo, porta-voz e editor` confirma 401 e 403 sem depender da página. As demais áreas de `/inspetor` ainda exigem `admin` no layout; o proxy e cada página também checam capacidade.

### Falhas encontradas e corrigidas

1. **Exclusão de conta sempre 400 para quem tem senha.** A tela pede a senha, mas `DELETE /account` só aceitava o apelido. Corrigido para aceitar também a senha, com teste. O apelido continua aceito, porque os testes atuais dependem disso; **recomendação:** exigir só a senha em contas que a têm.
2. Duas execuções falharam por razões de ambiente, sem defeito do produto: carga lenta do login logo após o deploy (a repetição passou) e o limite normal de cadastros por IP (429). Para a segunda, apaguei só as 4 linhas `signup:` do prefixo IPv6 desta máquina em `login_attempts` de staging; a regra não foi alterada.

### Onde estão as evidências (fora do Git)

`~/evidencias/oficina-amarela/2026-10-14-staging-e2e/` (41 MB): 36 screenshots, 8 `*-trace.zip` do Playwright, vídeo sintético, logs das duas execuções e os JSONs. Os JSONs pequenos estão em [execucao-final](./execucao-final/). Reprodução: ver o comando acima; o script de HTTP precisa de `CLOUDFLARE_ACCOUNT_ID`.

### R2: os bytes não estão imutáveis

- Staging (`oficina-amarela-midia-staging`) e produção (`oficina-amarela-midia`): **nenhuma regra de lock** e nenhuma expiração de objetos; só o aborto de multipart incompleto. Acesso `r2.dev` desativado em staging.
- A aplicação nunca apaga objetos (só `head`, multipart e leitura), e cada upload usa chave com UUID, então não há sobrescrita pelo código.
- **Limite:** quem tem credencial Cloudflare pode apagar objetos, e a retenção por denúncia existe só no D1. Por isso as evidências **não** devem ser declaradas imutáveis.
- **Proposta (precisa de aprovação, não aplicada):** (a) regra de lock por idade no prefixo `missions/`, testada primeiro em staging; ela vale para todo o prefixo e não pode ser desfeita antes do prazo; (b) ao abrir a denúncia, copiar os bytes das entregas para um prefixo próprio (`evidence/`) com lock, já que o R2 não tem retenção por objeto; (c) a liberação de retenção passaria a só liberar o registro no D1, não os bytes.

### Pendências

Dispositivos móveis físicos, PostgreSQL e produção não foram validados. Os commits de Videoaulas (`461c7d5`, `58af1d7`) são de outra sessão e não foram testados aqui.
