import { Resend } from "resend";

function cliente() {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY não configurado (.env.local)");
  return new Resend(chave);
}

// Placeholders que a gente mesmo põe no .env.local pra o app subir sem as
// chaves reais. Sem esta lista, `!!chave` dava true pra "dummy": a trava de
// 503 não disparava, o envio ia até o Resend, tomava 401 — e o usuário via
// "mandamos o link" de um e-mail que nunca saiu.
const PLACEHOLDERS = ["dummy", "changeme", "todo", "xxx", "placeholder"];

export function emailConfigurado() {
  const chave = process.env.RESEND_API_KEY?.trim();
  if (!chave) return false;
  if (PLACEHOLDERS.includes(chave.toLowerCase())) return false;
  // chave real do Resend começa com "re_"; abaixo disso é rascunho
  return chave.length >= 20;
}

/** Escapa texto que entra no HTML do e-mail. O nome vem do cadastro, ou
 *  seja, do usuário — sem isto ele injeta marcação no corpo da mensagem. */
function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Remetente. Vem de variável de ambiente pra que verificar o domínio no Resend
// seja só configurar EMAIL_REMETENTE na Vercel — sem mexer em código, sem
// publicar de novo.
//
// O padrão abaixo é o endereço de teste do Resend, e ele NÃO serve pra uso
// real: enquanto o domínio não estiver verificado lá, o Resend só entrega no
// e-mail de quem abriu a conta. É sandbox. Com ele configurado, quem pedir
// recuperação e não for você não recebe nada.
const REMETENTE = process.env.EMAIL_REMETENTE?.trim() || "Oficina Amarela <onboarding@resend.dev>";

/** O remetente ainda é o de sandbox do Resend? Se sim, só o dono da conta do
 *  Resend recebe — não dá pra prometer entrega a mais ninguém. */
export function remetenteEhDeTeste() {
  return REMETENTE.includes("resend.dev");
}

/**
 * Devolve se o envio deu certo.
 *
 * Antes engolia o erro e não contava a ninguém, pra não vazar quais e-mails
 * têm conta. A intenção era boa, mas juntava dois casos diferentes: "esse
 * e-mail não tem conta" (silêncio certo) e "o provedor recusou nossa chave"
 * (falha nossa — e a pessoa fica esperando um e-mail que nunca vem). Quem
 * decide o que dizer é a rota; aqui só reportamos o que aconteceu.
 */
export async function enviarEmailRecuperacao(
  destino: string,
  nome: string,
  link: string
): Promise<boolean> {
  const { error } = await cliente().emails.send({
    from: REMETENTE,
    to: destino,
    subject: "Recuperar sua senha — Oficina Amarela",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1c1c22;">
        <h1 style="font-size: 20px; color: #a9840e;">Oficina Amarela</h1>
        <p>Oi, ${escaparHtml(nome)}.</p>
        <p>Pediram pra redefinir a senha dessa conta. Se não foi você, ignora esse e-mail.</p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #f4ce1f; color: #1a1405; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Escolher nova senha
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">Esse link expira em 30 minutos.</p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] falha ao mandar recuperação:", error);
    return false;
  }
  return true;
}
