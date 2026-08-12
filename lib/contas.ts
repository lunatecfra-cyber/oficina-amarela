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

  const senha_hash = bcrypt.hashSync(dados.senha, 10);
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

  if (!linha || !linha.senha_hash || !bcrypt.compareSync(senha, linha.senha_hash)) {
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
  const senha_hash = bcrypt.hashSync(novaSenha, 10);
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
  let n = 1;
  while (true) {
    const [existente] = await sql`SELECT id FROM users WHERE lower(apelido) = lower(${apelido})`;
    if (!existente) return apelido;
    n += 1;
    apelido = `${base}${n}`;
  }
}
