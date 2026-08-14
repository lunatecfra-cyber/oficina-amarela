-- rodar uma vez contra o banco Postgres do Supabase (não roda automático a
-- cada request, ao contrário do que o SQLite fazia)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  apelido TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  senha_hash TEXT,
  google_id TEXT,
  papel TEXT NOT NULL CHECK (papel IN ('voz','editor','admin')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apelido ON users (lower(apelido));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

-- migração pra bancos criados antes de "admin" existir como papel — não é
-- self-service (ninguém cria conta admin pelo /criar-conta), só via script
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_papel_check;
ALTER TABLE users ADD CONSTRAINT users_papel_check CHECK (papel IN ('voz','editor','admin'));

-- corte de sessão: qualquer token emitido ANTES desse instante é recusado.
-- Atualizado ao trocar a senha, o que derruba sessões antigas de verdade
-- (a checagem acontece em lib/sessao-servidor.ts, não só grava por gravar).
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessoes_validas_apos TIMESTAMPTZ NOT NULL DEFAULT now();

-- trava de força bruta no login. Fica no Postgres (e não em memória) porque
-- na Vercel cada instância serverless tem memória própria — trava em memória
-- é contornada só trocando de instância.
CREATE TABLE IF NOT EXISTS tentativas_login (
  chave TEXT PRIMARY KEY,          -- apelido tentado (minúsculo)
  tentativas INT NOT NULL DEFAULT 0,
  primeira_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  travado_ate TIMESTAMPTZ
);

-- Campos de perfil que o próprio usuário edita (serve editor e porta-voz).
-- Ficam em users mesmo: são 1-pra-1 com a conta, não justificam tabela nova.
ALTER TABLE users ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS localizacao TEXT;

-- Números do editor. "entregues" é a fonte da verdade; o resto acompanha.
ALTER TABLE users ADD COLUMN IF NOT EXISTS entregues INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reputacao INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0;

-- nota fica NULL até existir avaliação de verdade. Default 5.0 faria um editor
-- sem nenhuma entrega aparecer com nota cheia pro porta-voz que fosse escolher.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nota NUMERIC(3,2);

-- nivel é COLUNA GERADA: o Postgres calcula a partir de entregues, seguindo os
-- mesmos cortes de NIVEIS em lib/perfil.ts (0/10/30/60). Como coluna comum ela
-- divergiria — o editor chegaria a 12 entregas e continuaria "Aspirante".
--
-- É DROP + ADD (e não ADD IF NOT EXISTS) porque o Postgres não deixa alterar a
-- expressão de uma coluna gerada. Recriar é seguro: o valor é 100% derivado de
-- entregues, não há dado próprio pra perder.
ALTER TABLE users DROP COLUMN IF EXISTS nivel;
ALTER TABLE users ADD COLUMN nivel TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN entregues >= 60 THEN 'Mestre-Artesão'
      WHEN entregues >= 30 THEN 'Artífice'
      WHEN entregues >= 10 THEN 'Oficial'
      ELSE 'Aprendiz'
    END
  ) STORED;

-- trava de reserva: enquanto essa data não passar, o editor não pode pegar
-- pauta nova (usada como penalidade por abandono/atraso)
ALTER TABLE users ADD COLUMN IF NOT EXISTS travado_reservas_ate TIMESTAMPTZ;

-- Quando a missão foi reservada. O prazo de entrega (reservada_ate, 24h)
-- foi REMOVIDO do produto: vencia e nada acontecia — a missão ficava presa
-- com um editor sumido, e o vídeo "se perdia". Agora a missão é do editor
-- até entregar ou devolver; o início explícito substitui o cálculo que a
-- agenda fazia (reservada_ate - 24h) pra saber quando começou.
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS reservada_em TIMESTAMPTZ;
-- backfill: missões antigas ganham início derivado do prazo que tinham
UPDATE pautas SET reservada_em = reservada_ate - interval '24 hours'
  WHERE reservada_em IS NULL AND reservada_ate IS NOT NULL;
-- o prazo morre: limpa o que existia pra nenhuma tela mostrar "vencido"
UPDATE pautas SET reservada_ate = NULL WHERE reservada_ate IS NOT NULL;

-- Banimento de conta pelo inspetor (controle de qualidade). `banido` recusa
-- o login (autenticar e Google) e `sessoes_validas_apos = now()` derruba a
-- sessão atual imediatamente — a checagem acontece em lib/sessao-servidor.ts
-- (lerSessao) e lib/contas.ts (autenticar). `motivo_banimento` é o registro
-- do porquê, visível só ao inspetor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS banido BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banido_em TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivo_banimento TEXT;

-- Onboarding do editor: o que ele domina, o estilo que faz e quando pode
-- pegar trabalho. Alimenta o match e a agenda.
ALTER TABLE users ADD COLUMN IF NOT EXISTS softwares TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS estilos TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_link TEXT;
-- grade [periodo][dia] = 3x7 booleanos. JSONB em vez de array multidimensional
-- do Postgres, que é chato de ler/escrever a partir do JS
ALTER TABLE users ADD COLUMN IF NOT EXISTS disponibilidade JSONB;
-- marca que o editor já passou pelo onboarding (senão não dá pra distinguir
-- "não preencheu" de "preencheu deixando tudo vazio")
ALTER TABLE users ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN NOT NULL DEFAULT false;

-- auto-avaliação do editor + o que ele tem de máquina + em que formato edita.
-- Sem CHECK de propósito: são rótulos de produto, mudam mais que schema, e um
-- CHECK obrigaria migração a cada ajuste de texto.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nivel_edicao TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_pc TEXT;
-- nicho é múltipla escolha (vertical e/ou horizontal) — array, não texto solto
ALTER TABLE users ADD COLUMN IF NOT EXISTS nicho TEXT[];

-- Perfil do candidato (porta-voz). Igual ao bloco do editor acima: rótulos
-- de produto, sem CHECK de propósito. foto_url pode ser uma URL do Google
-- (curta) ou um data URL de upload manual (grande) — TEXT aceita os dois.
ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disputa_por TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ano_eleicao TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bandeiras TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS tom_comunicacao TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS palavras_chave TEXT[];
-- redes sociais: objeto {instagram, youtube, tiktok, x}, todos opcionais
ALTER TABLE users ADD COLUMN IF NOT EXISTS redes_sociais JSONB;

-- (a tabela avaliacoes fica lá embaixo, depois de pautas — ela referencia
-- pautas e o Postgres exige que a tabela referenciada já exista)

CREATE TABLE IF NOT EXISTS portfolio (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('short','longo')),
  porta_voz TEXT NOT NULL,
  tint TEXT,
  link_video TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conquistas (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL,
  conquistado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id);
CREATE INDEX IF NOT EXISTS idx_conquistas_user ON conquistas (user_id);

-- Pautas: a demanda que o porta-voz cria e o editor pega.
-- Fica no banco (e não no localStorage) porque quem cria e quem pega são
-- PESSOAS DIFERENTES, em navegadores diferentes — localStorage nunca é
-- compartilhado entre usuários.
CREATE TABLE IF NOT EXISTS pautas (
  id SERIAL PRIMARY KEY,
  porta_voz_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('short','longo')),
  brief_tom TEXT,
  brief_cor TEXT,
  brief_fonte TEXT,
  brief_refs TEXT,
  drive_link TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel','reservada','em_revisao','reedicao','aprovada','finalizada')),
  reservada_por_id INT REFERENCES users(id) ON DELETE SET NULL,
  reservada_ate TIMESTAMPTZ,
  entrega_link TEXT,
  notas_inspetor TEXT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pautas_status ON pautas (status);
CREATE INDEX IF NOT EXISTS idx_pautas_porta_voz ON pautas (porta_voz_id);

-- Campos extras do brief que o porta-voz preenche no wizard de Nova Missão.
-- Antes estavam só no front e eram silenciosamente descartados no POST.
-- extras = cortes/trechos específicos (textarea, passo 2)
-- motivo = contexto/porquê do vídeo (textarea, passo 4)
-- prazo_desejado = quando o porta-voz gostaria de receber (date, passo 5)
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS extras TEXT;
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS prazo_desejado DATE;

-- 'finalizada' fecha o ciclo: o inspetor aprova (status 'aprovada') e só
-- então o porta-voz confere e aceita. O CREATE TABLE acima já nasce com ela,
-- mas bancos criados antes precisam do constraint recriado.
-- 'oferecida' é o dispatch: a missão está reservada em caráter provisório pro
-- editor que recebeu a oferta e some da lista aberta. Se ele recusar ou o
-- prazo vencer, volta pra 'disponivel' e vai pro próximo da rodada.
ALTER TABLE pautas DROP CONSTRAINT IF EXISTS pautas_status_check;
ALTER TABLE pautas ADD CONSTRAINT pautas_status_check
  CHECK (status IN ('disponivel','oferecida','reservada','em_revisao','reedicao','aprovada','finalizada'));

-- Trava de contagem dupla: aprovar dá entregues+1, reputacao+25 e streak+1 ao
-- editor. Como o porta-voz pode devolver pra reedição depois de aprovada, o
-- inspetor aprova a MESMA missão duas vezes — e sem isso o editor pontuava
-- em dobro.
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS pontuada BOOLEAN NOT NULL DEFAULT false;

-- 'inspetor' ou 'porta_voz': o editor precisa saber quem pediu o ajuste,
-- porque a conversa muda ("o controle de qualidade reprovou" é diferente de
-- "quem pediu o vídeo quer outra coisa").
ALTER TABLE pautas ADD COLUMN IF NOT EXISTS reedicao_pedida_por TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- Fila de dispatch (estilo Uber)
-- ─────────────────────────────────────────────────────────────────────
--
-- A missão não fica exposta pra todo mundo brigar: é OFERECIDA a um editor
-- por vez, com prazo pra responder. Recusou ou venceu -> vai pro próximo.
-- Rodou todo mundo sem ninguém pegar -> cai na lista aberta como antes.
--
-- Presença: não temos websocket, então "online" é derivado do próprio
-- polling. Cada chamada da fila carimba ultimo_visto_em; quem não aparece
-- há alguns minutos deixa de receber oferta (senão a missão ficaria parada
-- 5 min esperando alguém que fechou o navegador).
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_visto_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ofertas (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceita','rejeitada','expirada')),
  oferecida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondida_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL,
  -- posição desta oferta na rodada daquela missão (1 = primeiro tentado)
  ordem INT NOT NULL
);

-- A trava do dispatch: no máximo UMA oferta pendente por missão. Duas
-- chamadas simultâneas do despacho não conseguem oferecer a mesma missão
-- pra dois editores — a segunda viola o índice e é descartada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_uma_por_pauta
  ON ofertas (pauta_id) WHERE status = 'pendente';

-- Mesma ideia do outro lado: um editor não acumula ofertas pendentes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_uma_por_editor
  ON ofertas (editor_id) WHERE status = 'pendente';

-- Usado pra saber quem já passou por esta missão (não oferecer de novo).
CREATE INDEX IF NOT EXISTS idx_ofertas_pauta ON ofertas (pauta_id);

-- Avaliação da entrega. É daqui que a nota do editor vai sair — hoje
-- users.nota ainda é NULL porque nenhuma entrega foi avaliada.
-- Precisa vir DEPOIS de pautas: referencia pautas(id).
CREATE TABLE IF NOT EXISTS avaliacoes (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_editor ON avaliacoes (editor_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pauta ON avaliacoes (pauta_id);

-- ─────────────────────────────────────────────────────────────────────
-- Chat por missão
-- ─────────────────────────────────────────────────────────────────────
--
-- A conversa entre candidato e editor acontece PRESA À MISSÃO — não é
-- mensagem solta entre contas. Quem participa: o dono da pauta, o editor
-- que a reservou (enquanto for dele) e o inspetor (controle máximo — lê
-- tudo, pode escrever). O acesso é validado em enviarMensagem(), não só
-- na rota: papel diz "é um editor", o WHERE por reservada_por_id diz
-- "é O editor desta missão".
CREATE TABLE IF NOT EXISTS mensagens (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  autor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_pauta ON mensagens (pauta_id);

-- ─────────────────────────────────────────────────────────────────────
-- Denúncias (reclamações que chegam ao inspetor)
-- ─────────────────────────────────────────────────────────────────────
--
-- A denúncia nasce DENTRO de uma missão: quem reporta é sempre um dos
-- participantes, e o acusado é DEDUZIDO (candidato denuncia → acusado é o
-- editor que reservou; editor denuncia → acusado é o candidato dono).
-- denunciado_id é SET NULL de propósito: se a conta acusada for apagada,
-- o registro da denúncia sobrevive (histórico do inspetor não some junto).
CREATE TABLE IF NOT EXISTS denuncias (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  denunciante_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denunciado_id INT REFERENCES users(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','resolvida','ignorada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvida_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias (status);
