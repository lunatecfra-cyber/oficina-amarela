/**
 * Encolhe a foto no navegador, antes de sair do aparelho.
 *
 * O problema que isto resolve: foto de celular hoje sai com 3 a 8 MB, e o teto
 * de gravação é 1,5 MB. Na prática quase toda foto era recusada, e a pessoa via
 * "a foto precisa ter menos de 1,5 MB" sem ter como cumprir — nem todo mundo
 * sabe redimensionar imagem, e quem sabe não deveria precisar.
 *
 * Comprimir aqui, e não no servidor, por três motivos: o arquivo grande nunca
 * chega a subir (economiza os dados de quem está no 4G), não existe custo de
 * processamento nosso, e a foto vira `data:` URL guardada numa coluna de texto
 * — cada byte a mais é peso trafegado toda vez que o perfil aparece na tela.
 *
 * 512px de lado dá conta: a maior exibição da foto no sistema é o avatar do
 * perfil, bem abaixo disso mesmo em tela retina.
 */

const LADO_MAXIMO = 512;
const TETO_BYTES = 1_400_000; // um respiro abaixo do limite de 1,5 MB da gravação

/** Só o que o servidor aceita — recusar cedo evita processar o que seria
 *  rejeitado depois. SVG fica de fora de propósito: é XML e aceita script. */
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type ResultadoFoto =
  | { ok: true; dataUrl: string; bytesAntes: number; bytesDepois: number }
  | { ok: false; erro: string };

function lerComoImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem ilegível"));
    };
    img.src = url;
  });
}

export async function comprimirFoto(arquivo: File): Promise<ResultadoFoto> {
  if (!TIPOS.includes(arquivo.type)) {
    return { ok: false, erro: "Escolha uma imagem PNG, JPG ou WebP." };
  }

  let img: HTMLImageElement;
  try {
    img = await lerComoImagem(arquivo);
  } catch {
    return { ok: false, erro: "Não deu pra abrir essa imagem. Tenta outra." };
  }

  // mantém a proporção: encolhe pelo lado maior
  const maior = Math.max(img.width, img.height);
  const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
  const largura = Math.round(img.width * escala);
  const altura = Math.round(img.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, erro: "Seu navegador não deu conta de processar a imagem." };

  // suaviza ao reduzir, senão foto grande vira serrilhado
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, largura, altura);

  // Baixa a qualidade até caber. Começa em 0,82 — acima disso o ganho de
  // tamanho não compensa o que se enxerga num avatar. WebP porque comprime
  // melhor que JPEG na mesma qualidade; se o navegador não fizer WebP, o
  // toDataURL devolve PNG e o laço continua valendo pelo tamanho.
  for (const qualidade of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const dataUrl = canvas.toDataURL("image/webp", qualidade);
    if (dataUrl.length <= TETO_BYTES) {
      return {
        ok: true,
        dataUrl,
        bytesAntes: arquivo.size,
        bytesDepois: dataUrl.length,
      };
    }
  }

  // Chegou aqui com imagem enorme e cheia de detalhe. Última tentativa: metade
  // do lado, qualidade baixa. Se ainda não couber, aí é caso de dizer.
  const c2 = document.createElement("canvas");
  c2.width = Math.round(largura / 2);
  c2.height = Math.round(altura / 2);
  const ctx2 = c2.getContext("2d");
  if (ctx2) {
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = "high";
    ctx2.drawImage(img, 0, 0, c2.width, c2.height);
    const dataUrl = c2.toDataURL("image/webp", 0.5);
    if (dataUrl.length <= TETO_BYTES) {
      return { ok: true, dataUrl, bytesAntes: arquivo.size, bytesDepois: dataUrl.length };
    }
  }

  return { ok: false, erro: "Não deu pra reduzir essa imagem. Tenta outra foto." };
}
