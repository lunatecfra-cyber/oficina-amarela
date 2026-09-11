# Oficina Amarela — Visão Geral do Negócio

> Leitura de reconhecimento do produto em 2026-09-11 (v0.4.0).
> Este documento descreve o negócio, não a tecnologia. Detalhes técnicos
> vivem em `docs/SPEC.md`; plano e lançamento, em `docs/PLANO.md`,
> `docs/ROADMAP-COMPLETO.md` e `docs/CHECKLIST-LANCAMENTO.md`.

## 1. O negócio em uma frase

A **Oficina Amarela** é uma plataforma que liga **campanhas políticas que
precisam de vídeo editado** a **editores de vídeo parceiros**, com uma camada
de **qualidade e conformidade eleitoral** garantindo cada entrega.

## 2. Para quem existe

| Público | O que recebe |
|---|---|
| **Porta-vozes** (candidatos e equipes de campanha) | Um lugar único para pedir vídeos: abre a missão com briefing, acompanha o andamento, conversa com o editor, aprova a entrega com nota e publica. Sem planilha, sem WhatsApp espalhado |
| **Editores de vídeo** | Demanda organizada em fila, prazos claros, reputação que cresce a cada entrega aprovada, metas semanais com prêmios e um caminho de progressão (Aprendiz → Oficial → Artífice → Mestre-Artesão) |
| **Inspetores** (operação/qualidade) | Visão em tempo real de tudo, moderação da fila e das contas, convites para novos porta-vozes, auditoria das ações e comunicação oficial com a base |

## 3. Como o serviço funciona

1. **Pedido** — o porta-voz descreve o que quer (tom, cores, fontes,
   referências) e anexa o vídeo bruto.
2. **Distribuição** — a missão entra na fila e é oferecida aos editores
   disponíveis, um de cada vez: ninguém disputa a mesma pauta no grito e
   ninguém pega dois trabalhos ao mesmo tempo por acidente.
3. **Produção** — o editor reserva com prazo, edita e entrega dentro da
   plataforma, com chat direto com o porta-voz e o inspetor.
4. **Qualidade** — a entrega passa por revisão (o inspetor pode pedir
   reedição) e só então chega ao porta-voz para aprovação final com nota.
5. **Publicação** — aprovado, o porta-voz baixa e posta onde quiser.

Tudo é registrado: quem pediu, quem pegou, quem revisou, quem aprovou —
rastreabilidade completa por missão.

## 4. O que mantém a rede viva

- **Ranking de constância (ciclo eleitoral 2026)**: meta semanal pequena e
  atingível de entregas aprovadas, com tolerância para semanas curtas;
  quem mantém a constância por quatro semanas seguidas entra no sorteio.
- **Vitrine de prêmios progressiva**: quanto mais editores ativos, mais
  prêmios destravam — o crescimento da rede beneficia todo mundo.
- **Bloqueios de constância**: uma semana ruim não zera o histórico; o editor
  cobre a falha e segue no jogo. Retenção por design, não por punição.
- **Indicações premiadas**: editor que traz editor que entrega ganha
  reputação — recrutamento embutido no produto.
- **Porta de entrada controlada**: porta-voz só entra por convite nominal,
  o que protege a rede de curiosos e concentra atendimento em campanhas reais.

## 5. Serviços embutidos

- **Biblioteca de trilhas livres de royalties e aulas curtas** — o editor
  produz sem risco autoral e sem sair da plataforma.
- **E-mail operacional próprio** — confirmações, avisos de fila, entregas e
  aprovações chegam por e-mail transacional, além de webmail com domínio da
  casa para a equipe.
- **Novidades e broadcast** — a operação fala com toda a base (avisos,
  campanhas, comunicados) de dentro da plataforma.
- **Suporte a evidências de campanha** — perfis eleitorais, identidade de
  campanha e dados de candidatura organizados por perfil.

## 6. Confiança e conformidade

- **Conformidade eleitoral by design**: identidade de campanha e dados de
  candidatura (incluindo CNPJ) estruturados no fluxo, linguagem pública
  neutralizada conforme o manual interno.
- **Moderação e auditoria**: denúncias, moderação de contas, trilha de
  auditoria das ações administrativas e papéis com permissões estritas
  (cada perfil só executa o que lhe cabe em cada etapa da missão).
- **Privacidade (LGPD)**: política de privacidade publicada, com pendências
  mapeadas antes do lançamento real — encarregado de dados identificado,
  base legal por tratamento, consentimento explícito para integrações
  (ex.: Google Drive) e canal funcional para direitos do titular, além da
  identificação da empresa no rodapé exigida por lei. Ver
  `docs/OBRIGATORIO-LEGAL.md` e `docs/CHECKLIST-LANCAMENTO.md`.

## 7. Modelo operacional

- **Operação 100% em nuvem**, com ambientes separados de ensaio (staging) e
  produção — teste e dado real nunca se misturam.
- **Manutenção contínua automatizada**: expiração de ofertas, fila de
  e-mails e rotinas de casa funcionam sozinhas em ciclos de minutos, com
  fila de descarte para falhas.
- **Atendimento por papéis**: o inspetor cobre fila, qualidade, convites,
  bloqueios e comunicados; porta-voz e editor resolvem tudo dentro da
  missão, sem canal paralelo.
- **Medição**: telemetria de uso e de entrega alimenta decisões — aprovações
  por semana, tempo de atravessamento da missão, taxa de aprovação,
  editores ativos, retenção de constância e conversão de indicações são os
  indicadores naturais do negócio.

## 8. Estado atual

Em v0.4.0 a plataforma opera de ponta a ponta: missões, fila, ranking,
convites, webmail e comunicação com a base funcionam e são verificados por
testes automatizados, incluindo ensaios contra o ambiente de produção. A
frente agora é lançamento: identidade jurídica no site, DPO e bases legais
(LGPD), consentimentos explícitos e confirmação dos dados de produção após
o ensaio de migração.
