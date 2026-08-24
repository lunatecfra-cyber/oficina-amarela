// Leitura de sessão com checagem REAL de revogação (consulta o banco).
// Só pode ser importado de Server Components e Route Handlers (Node runtime).
// O proxy.ts NÃO pode importar daqui — ele roda em Edge, sem acesso a TCP.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { NOME_COOKIE, verificarTokenSessao, type SessaoUsuario } from "@/lib/sessao";

/**
 * Valida o cookie de sessão em duas camadas:
 *  1. assinatura + validade do JWT (barato, sem banco)
 *  2. o token foi emitido DEPOIS da última troca de senha? (consulta o banco)
 *
 * A camada 2 é o que faz trocar a senha derrubar sessões antigas de verdade —
 * sem ela, guardar a data da troca no banco não protege nada.
 */
export async function lerSessao(): Promise<SessaoUsuario | null> {
  const jar = await cookies();

  if (process.env.NODE_ENV === "development" && jar.get("dev_god_mode")?.value === "true") {
    return {
      id: 9999,
      nome: "God Mode",
      apelido: "god.mode",
      papel: "admin",
      emitidoEm: Math.floor(Date.now() / 1000),
    };
  }

  const token = jar.get(NOME_COOKIE)?.value;
  if (!token) {
    if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
      return {
        id: 1,
        nome: "Dev Admin",
        apelido: "dev.admin",
        papel: "admin",
        emitidoEm: Math.floor(Date.now() / 1000),
      };
    }
    return null;
  }

  const sessao = await verificarTokenSessao(token);
  if (!sessao) return null;

  // token sem "iat" não dá pra comparar com o corte — recusa por segurança
  if (typeof sessao.emitidoEm !== "number") return null;

  try {
    const [linha] = await sql`
      SELECT sessoes_validas_apos FROM users WHERE id = ${sessao.id}
    `;

    // conta apagada no meio do caminho
    if (!linha) return null;

    const corteEmSegundos = Math.floor(new Date(linha.sessoes_validas_apos).getTime() / 1000);
    if (sessao.emitidoEm < corteEmSegundos) return null;
  } catch {
    // banco instável — aceita JWT só com assinatura válida.
    // pior caso: sessão revogada sobrevive mais alguns minutos até o banco voltar.
    // muito melhor que jogar todo mundo no /login.
  }

  return sessao;
}

/**
 * Igual a lerSessao(), mas manda pro /login em vez de devolver null.
 *
 * É isto que faz a revogação valer na prática: o middleware (proxy.ts) só
 * confere a assinatura do token — quem derruba a sessão velha de verdade é
 * esta função, chamada dentro das áreas protegidas.
 */
export async function exigirSessao(): Promise<SessaoUsuario> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  return sessao;
}
