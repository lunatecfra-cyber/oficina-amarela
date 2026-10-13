# D. Matriz de Compatibilidade — plataforma atual × reunião de 11/10/2026

Todas as ideias abaixo são **PROPOSTAS** em avaliação, não requisitos aprovados. Classes: EXISTENTE · ADAPTAR · NOVA · CONFLITO · PENDENTE · DESCARTAR. Confiança: A/M/B (baseada em leitura de código e dados, não em prototipação).

| # | Proposta | Classe | Base existente / motivo | Conf. |
|---|---|---|---|---|
| 1 | Perfis públicos de editor | ADAPTAR | `candidato/[slug]` (perfil de porta-voz), `perfil`, `profiles.ts`; `portfolio` existe com 0 registros | M |
| 2 | Portfólio e especialidades | NOVA | tabela `portfolio` sem uso; sem campo/tabela de especialidade | M |
| 3 | Diretório de editores | NOVA (pequena) | usuários e perfis completos (15/22 editores) + ranking; falta listagem pública e política de privacidade | M |
| 4 | Treinamentos/comunidade | ADAPTAR | `aulas`, `tutorial-drive`; sem progresso/certificação persistidos | M |
| 5 | Mural de solicitações (escolha pelo editor) | ADAPTAR / **CONFLITO parcial** | Reserva transacional já existe (índice único + DO). Conflita com a distribuição **controlada por ofertas** (`offers`, expiração, prioridade); exige modo "aberto" convivendo com o atual | M |
| 6 | Serviços gratuito/remunerado | NOVA | não há conceito de tipo de serviço, plano, preço | A |
| 7 | Stories/Reels, simples/complexa | NOVA | missão não tem formato/complexidade; `rawMedia` aceita vídeo/foto (migrations 0004/0005); limites de duração dependem de metadados do upload | M |
| 8 | Prazos 48h/24h/12h/6h | ADAPTAR | expiração de ofertas e cron `*/5` existem; falta prazo de entrega por plano e penalidade | M |
| 9 | Revisões (2 rodadas pagas) | ADAPTAR | estado `em_revisao` e `reedicao` existem; sem contador/limite de rodadas | M |
| 10 | Cadastro com CPF obrigatório | PENDENTE | jurídico/LGPD; hoje não coletado. **RISCO** de minimização de dados | A |
| 11 | 4 solicitações gratuitas/mês | NOVA | existe limite de concorrência de editor; nenhum por solicitante (verificar `domain/limits.ts`) | M |
| 12 | Avaliação 1–5 + comentário | EXISTENTE/ADAPTAR | `reviews`, `profiles.ts`; confirmar escala | M |
| 13 | Nota automática 5★ após 48h | NOVA + **RISCO** | cron existe; mas infla reputação; ver E-03 | A |
| 14 | 5 edições gratuitas no onboarding | ADAPTAR | onboarding (`ONBOARDING-EDITOR.md`, `criar-perfil`) + contagem de finalizadas | M |
| 15 | Editor só voluntário | NOVA | requer flag/capacidade por editor | M |
| 16 | Nota mínima 3,5 p/ pago | ADAPTAR | pontuação existe, mas é eleitoral (ciclos), não média de estrelas; precisa de métrica própria | M |
| 17 | Distribuição por especialidade/prioridade | ADAPTAR | prioridade e fila existem (`mission-queue.ts`, `migrar-prioridade.mjs`); especialidade não | M |
| 18 | Limite de trabalhos simultâneos | EXISTENTE | índice `idx_pautas_missao_ativa_por_editor` (uma ativa por editor) e teto de bloqueios; confirmar limite numérico | M |
| 19 | Penalidades por atraso/não entrega | ADAPTAR | sistema de bloqueios/constância no ranking; sem regra de prazo-penalidade | B |
| 20 | Saldo retido/disponível, Pix, split 60/40 | NOVA + PENDENTE | nenhum componente de pagamento; `stripe` não integrado | A |
| 21 | Retenção 7 dias / liberação 48h | PENDENTE | **"exigência legal" não verificada**; depende de jurídico e do PSP | A |
| 22 | Valor livre escolhido pelo solicitante | PENDENTE | decisão de negócio; impacta fraude/conciliação | A |
| 23 | Supervisão/moderação | EXISTENTE/ADAPTAR | painel `inspetor`, `admin_audit`, banimento; precisa cobrir disputas e pagamentos | M |
| 24 | Ranking/reputação/premiações | ADAPTAR | ranking eleitoral por ciclos + campeonato; reputação por especialidade é nova | M |
| 25 | Expansão para outras especialidades | NOVA (futuro) | modelo de dados hoje é vídeo-cêntrico | B |

## Requisitos técnicos para pagamento (sem implementar)
Split e repasse, estorno, chargeback, webhooks idempotentes assinados, conciliação diária, ledger imutável (partida dobrada), KYC de editor, saque Pix, trilha de auditoria. **Nada disso existe.** D1 serve a ledger pequeno, mas exige transações com atomicidade (batch) e idempotência por chave externa.

## Pendências legais (não decididas por mim)
Natureza da arrecadação por missão/movimento (eleitoral e partidária — doação, serviço estimável em dinheiro, vedações e limites), tributação (NF/retenções, MEI/RPA), intermediação de pagamento (PSP regulado), LGPD (CPF, base legal, retenção), termos de uso. Requer assessoria especializada.
