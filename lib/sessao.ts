// ATENÇÃO: este arquivo é importado pelo middleware.ts, que roda em Edge runtime.
// NÃO importar nada de banco (lib/db, postgres.js) aqui — Edge não tem TCP e
// quebraria o middleware inteiro. A checagem de revogação que precisa do banco
// mora em lib/sessao-servidor.ts, que só roda em Node.
import { SignJWT, jwtVerify } from "jose";

export const NOME_COOKIE = "confraria_sessao";
const DURACAO = "30d";

/** Opções padrão para setar o cookie de sessão. `secure` fica true só em
 *  produção — em dev localhost não tem HTTPS e o navegador recusa cookies
 *  seguros. Todas as rotas de auth devem usar isso em vez de repetir inline. */
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function chave() {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new Error("AUTH_SECRET não configurado (.env.local)");
  return new TextEncoder().encode(segredo);
}

export type Papel = "voz" | "editor" | "admin";

export type SessaoUsuario = {
  id: number;
  apelido: string;
  nome: string;
  papel: Papel;
  emitidoEm?: number; // "iat" do JWT, em segundos — usado pra derrubar sessão antiga
};

export async function criarTokenSessao(usuario: SessaoUsuario) {
  return new SignJWT({ ...usuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACAO)
    .sign(chave());
}

export async function verificarTokenSessao(token: string): Promise<SessaoUsuario | null> {
  try {
    const { payload } = await jwtVerify(token, chave());
    if (
      typeof payload.id === "number" &&
      typeof payload.apelido === "string" &&
      typeof payload.nome === "string" &&
      (payload.papel === "voz" || payload.papel === "editor" || payload.papel === "admin")
    ) {
      return {
        id: payload.id,
        apelido: payload.apelido,
        nome: payload.nome,
        papel: payload.papel,
        emitidoEm: typeof payload.iat === "number" ? payload.iat : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// estado assinado de curta duração — usado pelo fluxo OAuth do Google como
// "state" (protege contra CSRF), sem precisar guardar nada no servidor. Não
// carrega mais o papel: isso só é escolhido DEPOIS do Google confirmar quem
// é a pessoa (ver criarIdentidadePendente abaixo) — antes, perguntar o papel
// antes do Google e o botão de login (sem essa pergunta) divergiam, e uma
// conta podia acabar criada com o papel errado sem avisar ninguém.
export async function criarEstadoAssinado() {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(chave());
}

export async function verificarEstadoAssinado(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, chave());
    return true;
  } catch {
    return false;
  }
}

// identidade do Google confirmada, mas ainda sem conta — carrega o
// necessário pra criar a conta assim que a pessoa escolher o papel na tela
// /escolher-papel. Curta duração de propósito: ninguém deveria demorar mais
// que alguns minutos pra escolher "editor" ou "porta-voz".
export type IdentidadeGooglePendente = {
  googleId: string;
  email: string;
  nome: string;
  foto?: string;
};

export async function criarIdentidadePendente(dados: IdentidadeGooglePendente) {
  return new SignJWT({ ...dados })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(chave());
}

export async function verificarIdentidadePendente(
  token: string
): Promise<IdentidadeGooglePendente | null> {
  try {
    const { payload } = await jwtVerify(token, chave());
    if (typeof payload.googleId === "string" && typeof payload.email === "string" && typeof payload.nome === "string") {
      return {
        googleId: payload.googleId,
        email: payload.email,
        nome: payload.nome,
        foto: typeof payload.foto === "string" ? payload.foto : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// token de recuperação de senha — assinado, expira em 30min, carrega o id
// da conta. Não precisa guardar nada no banco: o próprio token expira sozinho
export async function criarTokenRecuperacao(userId: number) {
  return new SignJWT({ uso: "recuperar-senha", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(chave());
}

export async function verificarTokenRecuperacao(
  token: string
): Promise<{ userId: number; emitidoEmMs: number } | null> {
  try {
    const { payload } = await jwtVerify(token, chave());
    if (
      payload.uso === "recuperar-senha" &&
      typeof payload.userId === "number" &&
      typeof payload.iat === "number"
    ) {
      // devolve quando foi emitido: quem chama compara com
      // users.sessoes_validas_apos pra recusar link já usado. `iat` vem em
      // segundos, aqui vira ms pra bater com o timestamp do banco.
      return { userId: payload.userId, emitidoEmMs: payload.iat * 1000 };
    }
    return null;
  } catch {
    return null;
  }
}
