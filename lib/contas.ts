import bcrypt from "bcryptjs";
import { LIMITES, limitar } from "@/lib/limites";
import { sql } from "@/lib/db";
import type { Papel } from "@/lib/sessao";

export type ContaUsuario = {
  id: number;
  apelido: string;
  nome: string;
  email: string;
  papel: Papel;
};

const RE_APELIDO = /^[a-z0-9._]{3,24}$/i;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function apelidoValido(apelido: string) {
  return RE_APELIDO.test(apelido.trim());
}

export async function criarConta(dados: {
  nome: string;
  apelido: string;
  email: string;
  senha: string;
  papel: Papel;
}): Promise<{ ok: true; conta: ContaUsuario } | { ok: false; erro: string }> {
  const nome = limitar(dados.nome, LIMITES.nome);
  const apelido = limitar(dados.apelido, LIMITES.apelido);
  const email = limitar(dados.email, LIMITES.email);

  if (!nome) return { ok: false, erro: "Digite seu nome." };
  // senha longa demais também é problema: bcrypt fica caro e vira porta de
  // negação de serviço barata
  if (dados.senha.length > 200) {
    return { ok: false, erro: "Senha longa demais." };
  }
  if (!apelidoValido(apelido)) {
    return { ok: false, erro: "Apelido deve ter 3-24 letras, números, ponto ou underline." };
  }
  if (!RE_EMAIL.test(email)) return { ok: false, erro: "Digite um e-mail válido." };
  if (dados.senha.length < 6) return { ok: false, erro: "Senha precisa de pelo menos 6 caracteres." };

  const [apelidoEmUso] = await sql`SELECT id FROM users WHERE lower(apelido) = lower(${apelido})`;
  if (apelidoEmUso) return { ok: false, erro: "Esse apelido já está em uso." };

  const [emailEmUso] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (emailEmUso) return { ok: false, erro: "Esse e-mail já está cadastrado." };

  const senha_hash = await bcrypt.hash(dados.senha, 10);
  const [linha] = await sql`
    INSERT INTO users (apelido, nome, email, senha_hash, papel)
    VALUES (${apelido}, ${nome}, ${email}, ${senha_hash}, ${dados.papel})
    RETURNING id
  `;

  return { ok: true, conta: { id: linha.id, apelido, nome, email, papel: dados.papel } };
}

export async function autenticar(
  apelido: string,
  senha: string
): Promise<{ ok: true; conta: ContaUsuario } | { ok: false; erro: string }> {
  const [linha] = await sql`
    SELECT id, apelido, nome, email, papel, senha_hash
    FROM users
    WHERE lower(apelido) = lower(${apelido.trim()})
  `;

  if (!linha || !linha.senha_hash || !(await bcrypt.compare(senha, linha.senha_hash))) {
    return { ok: false, erro: "Apelido ou senha incorretos." };
  }

  return {
    ok: true,
    conta: { id: linha.id, apelido: linha.apelido, nome: linha.nome, email: linha.email, papel: linha.papel },
  };
}

/**
 * Só procura — nunca cria. Chamada logo que o Google confirma quem é a
 * pessoa, antes de saber se ela é editor ou porta-voz. Conta existente
 * entra direto no papel que já tem (nunca se pergunta de novo); `conta:
 * null` quer dizer "identidade nova", quem chama decide o que fazer (hoje:
 * manda pra tela de escolher o papel).
 */
export async function buscarContaGoogle(
  googleId: string,
  email: string
): Promise<{ ok: true; conta: ContaUsuario | null } | { ok: false; erro: string }> {
  const [porGoogleId] = await sql`
    SELECT id, apelido, nome, email, papel FROM users WHERE google_id = ${googleId}
  `;
  if (porGoogleId) return { ok: true, conta: porGoogleId as ContaUsuario };

  const [porEmail] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (porEmail) {
    return { ok: false, erro: "Esse e-mail já tem conta na Oficina Amarela — entra com apelido e senha." };
  }

  return { ok: true, conta: null };
}

/** Cria a conta Google depois que a pessoa escolheu o papel em /escolher-papel. */
export async function criarContaGoogle(dados: {
  googleId: string;
  email: string;
  nome: string;
  papel: Papel;
  foto?: string;
}): Promise<{ ok: true; conta: ContaUsuario } | { ok: false; erro: string }> {
  const apelido = await gerarApelidoUnico(dados.email);
  const [linha] = await sql`
    INSERT INTO users (apelido, nome, email, google_id, papel, foto_url)
    VALUES (${apelido}, ${dados.nome}, ${dados.email}, ${dados.googleId}, ${dados.papel}, ${dados.foto ?? null})
    RETURNING id
  `;

  return {
    ok: true,
    conta: { id: linha.id, apelido, nome: dados.nome, email: dados.email, papel: dados.papel },
  };
}

export async function buscarContaPorEmail(email: string): Promise<ContaUsuario | null> {
  const [linha] = await sql`
    SELECT id, apelido, nome, email, papel FROM users WHERE lower(email) = lower(${email.trim()})
  `;
  return (linha as ContaUsuario) ?? null;
}

/**
 * Apaga a conta e tudo que é dela.
 *
 * A política publicada em /privacidade promete isso desde sempre, e não havia
 * código nenhum por trás — nem canal manual, porque o e-mail de contato era
 * um placeholder. A LGPD (art. 18) dá esse direito ao titular.
 *
 * Um DELETE só resolve: as foreign keys do schema já cascateiam. `portfolio`,
 * `conquistas`, `pautas` (as que ele criou), `avaliacoes` e `ofertas` vão
 * junto; a missão que um editor tinha em mãos volta pra fila em vez de sumir
 * (`reservada_por_id ... ON DELETE SET NULL`).
 *
 * Consequência aceita: apagar um porta-voz leva as missões dele, e com elas
 * as avaliações — o histórico do editor perde esses itens. Anonimizar
 * preservaria, mas seria menos honesto com o que o texto publicado promete.
 */
/** Conta criada pelo Google não tem senha — a tela precisa saber o que pedir
 *  como confirmação. */
export async function contaTemSenha(userId: number): Promise<boolean> {
  const [linha] = await sql`SELECT senha_hash FROM users WHERE id = ${userId}`;
  return !!linha?.senha_hash;
}

export async function apagarConta(
  userId: number,
  confirmacao: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [linha] = await sql`
    SELECT apelido, senha_hash FROM users WHERE id = ${userId}
  `;
  if (!linha) return { ok: false, erro: "Conta não encontrada." };

  // conta criada pelo Google não tem senha: a confirmação é digitar o
  // próprio apelido, que é o que ela tem de próprio
  const confere = linha.senha_hash
    ? await bcrypt.compare(confirmacao, linha.senha_hash)
    : confirmacao.trim().toLowerCase() === String(linha.apelido).toLowerCase();

  if (!confere) {
    return {
      ok: false,
      erro: linha.senha_hash
        ? "Senha incorreta."
        : "Digite seu apelido exatamente como ele aparece.",
    };
  }

  // Antes de apagar, devolver pra fila o que ele tinha em mãos.
  //
  // O `ON DELETE SET NULL` do schema limpa `reservada_por_id`, mas não mexe
  // no status: a missão ficava 'reservada' sem reservante nenhum — invisível
  // pra `pautasDisponiveis` (que filtra 'disponivel') e nunca mais
  // despachada. Missão zumbi, presa pra sempre, e o porta-voz sem entender
  // por que o vídeo dele parou.
  //
  // 'em_revisao' fica de fora de propósito: o vídeo já foi entregue e está
  // com o inspetor. Devolver pra fila jogaria fora trabalho pronto.
  await sql`
    UPDATE pautas
    SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL
    WHERE reservada_por_id = ${userId} AND status IN ('reservada','reedicao','oferecida')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { ok: true };
}

/**
 * O link de recuperação já foi gasto?
 *
 * Não existe registro de "token usado" — e não precisa. Trocar a senha grava
 * `sessoes_validas_apos = now()`, então qualquer link emitido ANTES desse
 * instante já cumpriu (ou perdeu) a função. Isso fecha o reuso: o mesmo link
 * trocava a senha quantas vezes quisesse dentro dos 30 minutos, e ele viaja
 * por e-mail — fica em caixa de entrada, log de gateway, histórico.
 */
export async function linkRecuperacaoJaUsado(
  userId: number,
  emitidoEmMs: number
): Promise<boolean> {
  const [linha] = await sql`
    SELECT sessoes_validas_apos FROM users WHERE id = ${userId}
  `;
  if (!linha?.sessoes_validas_apos) return false; // nunca trocou senha
  return emitidoEmMs < new Date(linha.sessoes_validas_apos).getTime();
}

export async function atualizarSenha(
  userId: number,
  novaSenha: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (novaSenha.length < 6) return { ok: false, erro: "Senha precisa de pelo menos 6 caracteres." };
  const senha_hash = await bcrypt.hash(novaSenha, 10);
  // sessoes_validas_apos = now() derruba todos os cookies emitidos antes daqui
  // (quem confere isso é lerSessao() em lib/sessao-servidor.ts)
  await sql`
    UPDATE users
    SET senha_hash = ${senha_hash}, sessoes_validas_apos = now()
    WHERE id = ${userId}
  `;
  return { ok: true };
}

// ---- trava de taxa ---------------------------------------------------------
// Guardada no Postgres de propósito: em memória não funciona na Vercel, porque
// cada instância serverless tem a própria memória (basta cair noutra instância
// pra zerar a contagem).
//
// A tabela `tentativas_login` nasceu só pro login, mas é um contador genérico
// por chave — serve pra qualquer ação que precise de freio. As chaves vão
// prefixadas ("login:", "cadastro:", "recuperar:") pra um cadastro em massa
// não travar o login de alguém por acidente.

const MAX_TENTATIVAS = 5;
const MINUTOS_TRAVA = 15;
const MINUTOS_JANELA = 15; // tentativas velhas que isso são esquecidas

/** Está travado agora? Devolve quantos minutos faltam. */
export async function taxaTravada(
  chaveBruta: string
): Promise<{ travado: boolean; minutos: number }> {
  const chave = chaveBruta.trim().toLowerCase();
  const [linha] = await sql`SELECT travado_ate FROM tentativas_login WHERE chave = ${chave}`;
  if (!linha?.travado_ate) return { travado: false, minutos: 0 };

  const restanteMs = new Date(linha.travado_ate).getTime() - Date.now();
  if (restanteMs <= 0) return { travado: false, minutos: 0 };

  return { travado: true, minutos: Math.max(1, Math.ceil(restanteMs / 60000)) };
}

/** Conta mais uma tentativa. Estourou o teto, tranca pelo tempo da janela. */
export async function registrarTentativa(
  chaveBruta: string,
  max = MAX_TENTATIVAS
): Promise<void> {
  const chave = chaveBruta.trim().toLowerCase();

  // ON CONFLICT resolve a corrida entre duas tentativas simultâneas: o banco
  // serializa, então o contador não se perde.
  const [linha] = await sql`
    INSERT INTO tentativas_login (chave, tentativas, primeira_em)
    VALUES (${chave}, 1, now())
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE
        WHEN tentativas_login.primeira_em < now() - (${MINUTOS_JANELA} || ' minutes')::interval
          THEN 1
        ELSE tentativas_login.tentativas + 1
      END,
      primeira_em = CASE
        WHEN tentativas_login.primeira_em < now() - (${MINUTOS_JANELA} || ' minutes')::interval
          THEN now()
        ELSE tentativas_login.primeira_em
      END
    RETURNING tentativas
  `;

  if (linha && linha.tentativas >= max) {
    await sql`
      UPDATE tentativas_login
      SET travado_ate = now() + (${MINUTOS_TRAVA} || ' minutes')::interval,
          tentativas = 0,
          primeira_em = now()
      WHERE chave = ${chave}
    `;
  }
}

// ---- atalhos por ação ------------------------------------------------------

export const loginTravado = (apelido: string) => taxaTravada(`login:${apelido}`);
export const registrarFalhaLogin = (apelido: string) =>
  registrarTentativa(`login:${apelido}`);

export async function limparTentativasLogin(apelido: string): Promise<void> {
  await sql`DELETE FROM tentativas_login WHERE chave = ${`login:${apelido}`.trim().toLowerCase()}`;
}

async function gerarApelidoUnico(email: string): Promise<string> {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20) || "usuario";
  let apelido = base;

  // O teto evita o pior caso: se a consulta passar a devolver linha sempre
  // (base corrompida, coluna errada num refactor), o `while (true)` original
  // martelaria o banco pra sempre e a requisição nunca responderia. Com 50
  // colisões reais de um mesmo prefixo já é sinal de outra coisa errada.
  for (let n = 1; n <= 50; n++) {
    const [existente] = await sql`SELECT id FROM users WHERE lower(apelido) = lower(${apelido})`;
    if (!existente) return apelido;
    apelido = `${base}${n + 1}`;
  }

  // desiste do prefixo e vai pro aleatório, em vez de falhar o cadastro
  return `${base.slice(0, 12)}${Math.random().toString(36).slice(2, 8)}`;
}
