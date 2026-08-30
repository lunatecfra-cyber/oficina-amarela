import { Resend } from "resend";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurado (.env.local)");
  return new Resend(key);
}

const PLACEHOLDERS = ["dummy", "changeme", "todo", "xxx", "placeholder"];

export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  if (PLACEHOLDERS.includes(key.toLowerCase())) return false;
  return key.length >= 20;
}

export const emailConfigurado = isEmailConfigured;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SENDER =
  process.env.EMAIL_REMETENTE?.trim() ||
  process.env.EMAIL_SENDER?.trim() ||
  "Oficina Amarela <onboarding@resend.dev>";

export function isTestSender(): boolean {
  return SENDER.includes("resend.dev");
}

export const remetenteEhDeTeste = isTestSender;

export async function sendPasswordRecoveryEmail(
  to: string,
  name: string,
  link: string,
): Promise<boolean> {
  const { error } = await getClient().emails.send({
    from: SENDER,
    to,
    subject: "Recuperar sua senha — Oficina Amarela",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1c1c22;">
        <h1 style="font-size: 20px; color: #a9840e;">Oficina Amarela</h1>
        <p>Oi, ${escapeHtml(name)}.</p>
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

export const enviarEmailRecuperacao = sendPasswordRecoveryEmail;

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

async function sendNotification(destination: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured() || isTestSender() || !destination) return;
  try {
    const { error } = await getClient().emails.send({
      from: SENDER,
      to: destination,
      subject,
      html,
    });
    if (error) console.error("[email] falha ao avisar:", subject, error);
  } catch (e) {
    console.error("[email] exceção ao avisar:", subject, e);
  }
}

export const avisar = sendNotification;

/**
 * Entrega uma mensagem já pronta. Devolve true quando o provedor aceitou.
 *
 * Sem provedor configurado (ou com remetente de teste) devolve true: a
 * mensagem sai da fila em vez de ficar girando em retentativa por uma
 * configuração ausente. O aviso vai para o log.
 */
export async function deliverEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!isEmailConfigured() || isTestSender() || !to) {
    console.warn("[email] provedor não configurado; descartando:", subject);
    return true;
  }
  const { error } = await getClient().emails.send({ from: SENDER, to, subject, html });
  if (error) {
    console.error("[email] provedor recusou:", subject, error);
    return false;
  }
  return true;
}

export function buildMissionAcceptedEmail(
  name: string,
  title: string,
  editor: string,
  url: string,
): EmailContent {
  return {
    subject: `Um editor pegou "${title}"`,
    html: moldura(
      `${escapeHtml(editor)} começou a editar seu vídeo`,
      `<p>Oi, ${escapeHtml(name)}. A missão <b>${escapeHtml(title)}</b> saiu da fila e está sendo trabalhada agora.</p>
       <p>Você recebe outro aviso quando o vídeo ficar pronto.</p>`,
      { url, texto: "Acompanhar a missão" },
    ),
  };
}

export function notifyMissionAccepted(
  destination: string,
  name: string,
  title: string,
  editor: string,
  url: string,
) {
  const { subject, html } = buildMissionAcceptedEmail(name, title, editor, url);
  return sendNotification(destination, subject, html);
}
export const avisarMissaoAceita = notifyMissionAccepted;

export function buildDeliveryReadyEmail(name: string, title: string, url: string): EmailContent {
  return {
    subject: `Seu vídeo está pronto: "${title}"`,
    html: moldura(
      "O editor entregou seu vídeo",
      `<p>Oi, ${escapeHtml(name)}. O vídeo da missão <b>${escapeHtml(title)}</b> ficou pronto.</p>
       <p>Assista e diga se pode ir pro ar — ou peça um ajuste, se algo não ficou como você queria.</p>`,
      { url, texto: "Ver o vídeo" },
    ),
  };
}

export function notifyDeliveryReady(destination: string, name: string, title: string, url: string) {
  const { subject, html } = buildDeliveryReadyEmail(name, title, url);
  return sendNotification(destination, subject, html);
}
export const avisarEntregaPronta = notifyDeliveryReady;

export function buildApprovedDeliveryEmail(
  name: string,
  title: string,
  rating: number | undefined,
  url: string,
): EmailContent {
  return {
    subject: `Aprovaram sua entrega: "${title}"`,
    html: moldura(
      "Sua entrega foi aprovada",
      `<p>Oi, ${escapeHtml(name)}. A missão <b>${escapeHtml(title)}</b> foi aprovada.</p>
       ${rating !== undefined ? `<p>Nota recebida: <b>${rating} de 5</b>.</p>` : ""}
       <p>Sua fila está livre — a próxima missão já pode chegar.</p>`,
      { url, texto: "Ver minha fila" },
    ),
  };
}

export function notifyApprovedDelivery(
  destination: string,
  name: string,
  title: string,
  rating: number | undefined,
  url: string,
) {
  const { subject, html } = buildApprovedDeliveryEmail(name, title, rating, url);
  return sendNotification(destination, subject, html);
}
export const avisarEntregaAprovada = notifyApprovedDelivery;

export function buildReEditRequestedEmail(
  name: string,
  title: string,
  notes: string,
  url: string,
): EmailContent {
  return {
    subject: `Pediram um ajuste em "${title}"`,
    html: moldura(
      "A missão voltou pra você",
      `<p>Oi, ${escapeHtml(name)}. Pediram um ajuste em <b>${escapeHtml(title)}</b>.</p>
       ${notes.trim() ? `<p style="background:#f6f4ee; border-left:3px solid #f4ce1f; padding:12px 14px; margin:16px 0;">${escapeHtml(notes)}</p>` : ""}
       <p>A missão está de volta na sua mão — é só entregar de novo quando estiver pronta.</p>`,
      { url, texto: "Abrir a missão" },
    ),
  };
}

export function notifyReEditRequested(
  destination: string,
  name: string,
  title: string,
  notes: string,
  url: string,
) {
  const { subject, html } = buildReEditRequestedEmail(name, title, notes, url);
  return sendNotification(destination, subject, html);
}
export const avisarReedicaoPedida = notifyReEditRequested;

export type EmailContent = { subject: string; html: string };

export function buildEditorsQueueEmail(name: string, inQueue: number, url: string): EmailContent {
  return {
    subject: `Tem ${inQueue} miss${inQueue === 1 ? "ão" : "ões"} esperando editor`,
    html: moldura(
      "Tem missões na fila de edição",
      `<p>Oi, ${escapeHtml(name)}. Tem <b>${inQueue} miss${inQueue === 1 ? "ão" : "ões"}</b> na fila esperando alguém pra pegar.</p>
       <p>Acesse o site e pegue a próxima.</p>`,
      { url, texto: "Ver a fila" },
    ),
  };
}

export function notifyEditorsQueue(
  destination: string,
  name: string,
  inQueue: number,
  url: string,
) {
  const { subject, html } = buildEditorsQueueEmail(name, inQueue, url);
  return sendNotification(destination, subject, html);
}
export const avisarEditoresFila = notifyEditorsQueue;

export function buildFreeEditorsEmail(
  name: string,
  freeEditors: number,
  url: string,
): EmailContent {
  return {
    subject: "Tem editores disponíveis pra sua missão",
    html: moldura(
      "Editores livres esperando uma missão",
      `<p>Oi, ${escapeHtml(name)}. Tem <b>${freeEditors} editor${freeEditors === 1 ? "" : "es"}</b> disponíveis agora.</p>
       <p>Se você tem um vídeo pra editar, é só criar.</p>`,
      { url, texto: "Criar missão" },
    ),
  };
}

export function notifySpokespersonsFreeEditors(
  destination: string,
  name: string,
  freeEditors: number,
  url: string,
) {
  const { subject, html } = buildFreeEditorsEmail(name, freeEditors, url);
  return sendNotification(destination, subject, html);
}
export const avisarCandidatosEditoresLivres = notifySpokespersonsFreeEditors;

export const notifyEditorsOfQueueMissions = notifyEditorsQueue;
export const notifySpokespersonsOfAvailableEditors = notifySpokespersonsFreeEditors;
