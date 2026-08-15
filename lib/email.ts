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

// ---- avisos do ciclo da missão ---------------------------------------------
//
// O sistema mandava UM e-mail: recuperação de senha. Nada avisava que a missão
// foi aceita, que o vídeo ficou pronto ou que voltou pra ajuste — a pessoa só
// descobria abrindo o site por conta própria. Foi assim que a entrega passou
// dias parecendo que não tinha acontecido.
//
// Nenhum destes pode derrubar a ação que os disparou: se o Resend estiver fora
// do ar, a missão continua entregue e a aprovação continua valendo. Por isso
// `avisar` engole a falha e só registra — quem chama nem espera resposta.

const CORPO = `font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1c1c22;`;
const TITULO = `font-size: 20px; color: #a9840e; margin: 0 0 16px;`;
const BOTAO = `display: inline-block; background: #f4ce1f; color: #1a1405; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;`;
const RODAPE = `font-size: 12px; color: #888; margin-top: 28px; border-top: 1px solid #eee; padding-top: 12px;`;

function moldura(titulo: string, miolo: string, link?: { url: string; texto: string }) {
  return `
    <div style="${CORPO}">
      <h1 style="${TITULO}">Oficina Amarela</h1>
      <p style="font-size: 17px; font-weight: bold; margin: 0 0 12px;">${titulo}</p>
      ${miolo}
      ${link ? `<p style="margin: 26px 0;"><a href="${link.url}" style="${BOTAO}">${link.texto}</a></p>` : ""}
      <p style="${RODAPE}">Você recebe este aviso porque tem conta na Oficina Amarela.</p>
    </div>
  `;
}

/** Manda e esquece. Falha de e-mail nunca desfaz o que já aconteceu no banco. */
async function avisar(destino: string, assunto: string, html: string): Promise<void> {
  if (!emailConfigurado() || remetenteEhDeTeste() || !destino) return;
  try {
    const { error } = await cliente().emails.send({ from: REMETENTE, to: destino, subject: assunto, html });
    if (error) console.error("[email] falha ao avisar:", assunto, error);
  } catch (e) {
    console.error("[email] exceção ao avisar:", assunto, e);
  }
}

/** Pro porta-voz: um editor pegou a missão. É o primeiro sinal de vida depois
 *  de criar — sem ele a missão parece ter caído num buraco. */
export function avisarMissaoAceita(destino: string, nome: string, titulo: string, editor: string, url: string) {
  return avisar(
    destino,
    `Um editor pegou "${titulo}"`,
    moldura(
      `${escaparHtml(editor)} começou a editar seu vídeo`,
      `<p>Oi, ${escaparHtml(nome)}. A missão <b>${escaparHtml(titulo)}</b> saiu da fila e está sendo trabalhada agora.</p>
       <p>Você recebe outro aviso quando o vídeo ficar pronto.</p>`,
      { url, texto: "Acompanhar a missão" }
    )
  );
}

/** Pro porta-voz: o vídeo ficou pronto. É o aviso que mais faltava — sem ele a
 *  pessoa abria o site sem saber que já tinha algo pra ver. */
export function avisarEntregaPronta(destino: string, nome: string, titulo: string, url: string) {
  return avisar(
    destino,
    `Seu vídeo está pronto: "${titulo}"`,
    moldura(
      "O editor entregou seu vídeo",
      `<p>Oi, ${escaparHtml(nome)}. O vídeo da missão <b>${escaparHtml(titulo)}</b> ficou pronto.</p>
       <p>Assista e diga se pode ir pro ar — ou peça um ajuste, se algo não ficou como você queria.</p>`,
      { url, texto: "Ver o vídeo" }
    )
  );
}

/** Pro editor: aprovaram. Fecha o ciclo e conta a pontuação — é o que dá
 *  sentido a ter entregue. */
export function avisarEntregaAprovada(destino: string, nome: string, titulo: string, nota: number | undefined, url: string) {
  return avisar(
    destino,
    `Aprovaram sua entrega: "${titulo}"`,
    moldura(
      "Sua entrega foi aprovada",
      `<p>Oi, ${escaparHtml(nome)}. A missão <b>${escaparHtml(titulo)}</b> foi aprovada.</p>
       ${nota !== undefined ? `<p>Nota recebida: <b>${nota} de 5</b>.</p>` : ""}
       <p>Sua fila está livre — a próxima missão já pode chegar.</p>`,
      { url, texto: "Ver minha fila" }
    )
  );
}

/** Pro editor: pediram ajuste. Sem isso ele não tem como saber que a missão
 *  voltou pra mão dele. */
export function avisarReedicaoPedida(destino: string, nome: string, titulo: string, notas: string, url: string) {
  return avisar(
    destino,
    `Pediram um ajuste em "${titulo}"`,
    moldura(
      "A missão voltou pra você",
      `<p>Oi, ${escaparHtml(nome)}. Pediram um ajuste em <b>${escaparHtml(titulo)}</b>.</p>
       ${notas.trim() ? `<p style="background:#f6f4ee; border-left:3px solid #f4ce1f; padding:12px 14px; margin:16px 0;">${escaparHtml(notas)}</p>` : ""}
       <p>A missão está de volta na sua mão — é só entregar de novo quando estiver pronta.</p>`,
      { url, texto: "Abrir a missão" }
    )
  );
}
