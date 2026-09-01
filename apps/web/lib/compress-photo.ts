const MAX_SIDE = 512;
const BYTE_CEILING = 1_400_000;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type PhotoResult =
  | {
      ok: true;
      dataUrl: string;
      bytesBefore: number;
      bytesAfter: number;
      bytesAntes?: number;
      bytesDepois?: number;
    }
  | { ok: false; error: string; erro?: string };

export type ResultadoFoto = PhotoResult;

function readAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
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

export async function compressPhoto(file: File): Promise<PhotoResult> {
  if (!TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Escolha uma imagem PNG, JPG ou WebP.",
      erro: "Escolha uma imagem PNG, JPG ou WebP.",
    };
  }

  let img: HTMLImageElement;
  try {
    img = await readAsImage(file);
  } catch {
    return {
      ok: false,
      error: "Não deu pra abrir essa imagem. Tenta outra.",
      erro: "Não deu pra abrir essa imagem. Tenta outra.",
    };
  }

  const max = Math.max(img.width, img.height);
  const scale = max > MAX_SIDE ? MAX_SIDE / max : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      ok: false,
      error: "Seu navegador não deu conta de processar a imagem.",
      erro: "Seu navegador não deu conta de processar a imagem.",
    };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (dataUrl.length <= BYTE_CEILING) {
      return {
        ok: true,
        dataUrl,
        bytesBefore: file.size,
        bytesAfter: dataUrl.length,
        bytesAntes: file.size,
        bytesDepois: dataUrl.length,
      };
    }
  }

  const c2 = document.createElement("canvas");
  c2.width = Math.round(width / 2);
  c2.height = Math.round(height / 2);
  const ctx2 = c2.getContext("2d");
  if (ctx2) {
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = "high";
    ctx2.drawImage(img, 0, 0, c2.width, c2.height);
    const dataUrl = c2.toDataURL("image/webp", 0.5);
    if (dataUrl.length <= BYTE_CEILING) {
      return {
        ok: true,
        dataUrl,
        bytesBefore: file.size,
        bytesAfter: dataUrl.length,
        bytesAntes: file.size,
        bytesDepois: dataUrl.length,
      };
    }
  }

  return {
    ok: false,
    error: "Não deu pra reduzir essa imagem. Tenta outra foto.",
    erro: "Não deu pra reduzir essa imagem. Tenta outra foto.",
  };
}
