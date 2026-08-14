<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Como trabalhar neste projeto

Duas regras, destiladas do [obra/superpowers](https://github.com/obra/superpowers)
(MIT) e mantidas porque foram justamente elas que acharam os bugs reais aqui.
A parte de TDD daquele pacote ficou de fora: o projeto não tem infra de teste,
e a lei dele ("nenhum código sem um teste falhando antes") pararia tudo.

## 1. Não diga que terminou sem verificar na hora

Antes de afirmar que algo está pronto:

1. Escolha o comando que **prova** a afirmação.
2. Rode **agora** — não vale resultado de antes.
3. Leia a saída inteira, não só o final.
4. Se a saída não sustenta a afirmação, diga o estado real.

**Não contam como prova:**
- Lint passando (não prova que compila).
- `tsc` passando (não prova que funciona na tela).
- O código ter sido alterado (não prova que corrigiu).
- Relatório de outro agente (verifique você mesmo).

**Palavras proibidas antes de verificar:** "deve", "provavelmente", "parece
que". Ou você rodou e leu, ou não sabe.

> Foi assim que apareceram, nesta ordem: os contadores do perfil que perdiam
> uma missão; a `headline` saindo como JSON cru na tela; a landing inteira
> dando 404 em `/entrar`; a missão duplicada na fila do editor.

## 2. Causa-raiz antes do remendo

**Nenhuma correção antes de entender a origem.**

1. **Investigar** — reproduza, leia o erro inteiro, siga o dado de trás pra
   frente até a fonte. Não pare no sintoma.
2. **Comparar** — ache no próprio código um caso que funciona e veja a
   diferença exata.
3. **Testar uma hipótese por vez** — uma mudança só. Duas ao mesmo tempo e
   você não sabe qual resolveu.
4. **Corrigir** na origem, e provar (regra 1).

**Três tentativas falhas = pare.** O problema não é a hipótese, é a
arquitetura. Levante a cabeça e questione o desenho.

> O `sql.json()` gravando numa coluna `TEXT` só apareceu porque a busca foi
> até a origem. Remendar a tela teria escondido o mesmo bug no formulário de
> edição, onde nenhum chip marcava.

## Vocabulário

Na tela é **missão**. No código é `pauta` (tabela `pautas`, `lib/pautas.ts`,
rota `/api/pautas`). Ver `docs/PLANO.md` pra história dessa decisão.

## 3. Produção, beta e pacotes de atualização (REGRA DO DONO)

- **Este workspace é área de desenvolvimento (beta).** O que roda aqui é
  trabalho em andamento, não lançamento.
- **Produção (`oficinaamarela.com.br`, banco Neon) é intocada por padrão.**
  Deploys são MANUAIS (`vercel --prod`) — nada sobe sozinho, e não sobe nada
  sem o dono aprovar o pacote primeiro.
- **O próximo lançamento é um PACOTE DE ATUALIZAÇÃO** — um conjunto completo
  e testado de mudanças (ex.: chat + denúncias + migrações), nunca peças
  soltas aos pedaços.
- **Migração de banco ANTES do deploy, sempre.** Toda tabela/coluna nova no
  `supabase/schema.sql` tem script em `scripts/` — rodar no Neon antes de
  publicar, senão a tela quebra em produção (o `banido` quase quebrou assim
  uma vez; `mensagens`/`denuncias` são o caso atual).
- **Papel viaja no cookie (30 dias).** Promover/degradar conta só faz
  efeito quando a pessoa re-loga. Não é bug — é desenho. Ao mudar papel de
  alguém, avisar pra sair e entrar.

## 3. Modo Caveman

Seja extremamente conciso, direto e curto nas respostas. Sem introduções longas ou "blá-blá-blá". Use tópicos rápidos.

## 4. Papéis dos Agentes

- **Antigravity (Eu):** Sou o "operário". Faço código rápido, pontual e direto (assento o tijolo). Não tomo decisões de arquitetura.
- **ZCode:** É o "arquiteto/consultor principal". Ele define a estrutura, atualizações complexas e cria os planos.
- **Claude:** Operário secundário/apoio.
- Sempre respeitar a ponte (`PONTE_CLAUDE.md`) e os planos do ZCode (`.zcode/plans`).
