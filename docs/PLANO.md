# Oficina Amarela — Plano & Estrutura

> Plataforma que liga **porta-vozes → editores**, com **inspetor** validando a qualidade.
> Abordagem: **PC primeiro**, mas tem que ficar ótimo no celular.

## ⚠️ Regras invioláveis

- **Na tela, o termo é "missão/missões".** No código continua `pauta` (tabela
  `pautas`, `lib/pautas.ts`, rota `/api/pautas`) — só o texto visível muda.

  > **Regra revogada em 12/08/2026.** Antes valia o contrário: *"NUNCA usar a
  > palavra missão (nem Missio em latim) — é ligada a partido, não podemos
  > atrelar. Palavra oficial adotada: PAUTA."* Fica registrado porque o motivo
  > era de marca, não de estilo: havia receio de associação partidária. O Vitor
  > reavaliou e considerou o risco superado. Se alguém no futuro estranhar a
  > palavra na interface, a discussão já aconteceu — não é descuido.

## Decisões travadas

| Tema | Decisão |
| --- | --- |
| Cor base | **Prata** (estrutura, brasão, texto) |
| Cor de destaque | **Dourado/ouro** (botão principal, nível, conquista) |
| Fundo | **Preto texturizado** (trama diagonal + granulado) |
| Prioridade de tela | **PC primeiro**, ótimo no celular |
| Login | **Apelido + senha** E **login com Google** (Google é o caminho principal) |
| Stack | **Next.js 16 + Tailwind 4 + Supabase** |
| Tipografia | **Cinzel** (display) + **Sora** (interface) |
| Vídeos | **100% no Google Drive.** Banco guarda só links (texto) |
| Onde fica o bruto | **Drive pessoal de cada porta-voz** (não é mais um Drive central — mudou 27/07/2026) |
| Acesso ao bruto | **Restrito** — só o editor que reservou enxerga, via token do próprio porta-voz |
| Liberação | **Automática por API**, usando o token OAuth do Drive de quem subiu o bruto |
| Revogação | Ao vencer a reserva ou entregar, o acesso é **revogado** (mesmo token) |
| Reserva | **1 pauta por vez** por editor (regra do esboço do Vitor) |

## Papéis

| Papel | Função |
| --- | --- |
| **Porta-voz** | Envia bruto (link do Drive) + brief; valida entrega; posta |
| **Editor** ⭐ | Pega pauta da fila, reserva com prazo, edita, entrega |
| **Inspetor** | Valida qualidade, aprova ou pede reedição |

## Perfil (definido pelo Vitor)

- Apelido
- **Portfólio** logo abaixo do perfil
- **Histórico**: editor → vídeos que editou; porta-voz → vídeos postados
- **Nota/avaliação** — critério ainda a definir

## Demanda do porta-voz (formulário passo a passo)

Em partes, não tudo de uma vez:

1. Link do Drive com o vídeo bruto
2. Links/brutos específicos que quer no vídeo
3. O que ele gosta (estilo, referências)
4. Motivo/motivação

## Roadmap

- [x] **F0 — Identidade + Login** (design system, boas-vindas, login)
- [x] **F3 — Demanda do porta-voz** (wizard 5 passos + home "minhas missões") *(no banco)*
- [x] **F1 — Fila do editor** — virou **dispatch estilo Uber**: a missão é
      oferecida a um editor por vez, com 5 min pra responder; recusou ou venceu,
      vai pro próximo. Não existe mais lista aberta pra navegar. *(no banco)*
- [x] **F2 — Entrega** (link do editado) → vai pra "em revisão" *(no banco)*
- [x] **F5 — Perfil do editor** (capa, avatar, stats, portfólio, histórico, nível, conquistas) *(no banco)*
- [x] **Agenda** — a grade de disponibilidade **decide quem recebe oferta**:
      bloco ocupado = nenhuma missão naquele horário *(no banco)*
- [x] **Ranking** — editores reais por XP *(no banco)*
- [x] **F4 — Inspetor**: aprovar / pedir reedição *(no banco; a fila ainda
      concatena as missões de demonstração)*
- [x] **Validação do porta-voz** — depois do inspetor aprovar, o porta-voz
      confere e **aceita ou pede ajuste** (status `finalizada`)
- [x] **Aulas** — aba criada no nav; página é placeholder, sem conteúdo ainda
- [ ] **F6 — Auth real no Supabase** (apelido/senha + Google) + banco
- [x] **Perfil do porta-voz** (`/porta-voz/perfil`, missões criadas no lugar do portfólio) *(no banco)*
- [ ] **F7 — Perfil Estendido** (Abas de Certificações do Hub e Equipamentos/Setup do editor)

> **Onde ainda entram dados de demonstração** (decisão do Vitor: manter por
> ora): `app/porta-voz/page.tsx`, `app/porta-voz/perfil/page.tsx`,
> `components/fila-inspetor.tsx` e `app/candidato/[slug]/page.tsx` concatenam
> as missões fake de `lib/pautas.ts` com as do banco.


## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Tailwind 4** (tokens em `app/globals.css` via `@theme`)
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — falta configurar chaves
- ⚠️ Next 16 tem breaking changes: ler `node_modules/next/dist/docs/` antes de codar (regra do `AGENTS.md`)

## Como rodar

```bash
npm run dev      # http://localhost:3000
npm run build    # verificar erros
```

## Arquivos

- `app/globals.css` — design system (cores, textura, botões, inputs)
- `app/layout.tsx` — fontes Cinzel/Sora, textura de fundo
- `app/page.tsx` — boas-vindas + escolha de papel
- `app/login/page.tsx` — login (painel de marca no PC + formulário)
- `components/crest.tsx` — brasão reutilizável (prata/dourado)
- `components/login-form.tsx` — formulário de login
- `docs/PESQUISA-F1.md` — pesquisa dos concorrentes
- `docs/referencia-login-v1.html` — protótipo HTML antigo (referência histórica)

## Pendente com o Vitor

- [ ] Fazer o setup do **Google Cloud + Supabase** (ver `docs/SETUP-GOOGLE.md`) e me passar as chaves
- [ ] Critério da **nota/avaliação** do editor
- [x] ~~Prazo padrão de reserva~~ → **24h** pra entregar, e **5 min** pra
      responder a oferta antes dela passar pro próximo editor
- [x] ~~Editor pega 1 missão por vez?~~ → **sim**, travado no banco
- [ ] Referências visuais que ele ia mandar
- [ ] Missão que passa por todos os editores fica parada. Reoferecer depois de
      um tempo, ou o admin ver as órfãs numa tela?
- [ ] "Desafios do dia" (`/editor`) é decorativo: lista fixa, marcar não salva,
      o XP não entra em lugar nenhum. De onde saem os desafios?

## Para ligar o login do Google + Drive

Passo a passo completo (Google Cloud, Supabase, escopo de Drive): `docs/SETUP-GOOGLE.md`.
Resumo: login com Google já pede o escopo de Drive na mesma hora — não tem mais conta central,
cada porta-voz conecta o próprio Drive.

## Histórico

O protótipo HTML v1 (prata/preto, mobile-first) virou `docs/referencia-login-v1.html`.
Foi substituído pelo app Next.js quando entraram as decisões de PC-primeiro, dourado e login com Google.
