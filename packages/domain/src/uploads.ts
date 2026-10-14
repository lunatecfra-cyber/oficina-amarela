export type RawMediaKind = "video" | "image";

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const VIDEO_MAX_BYTES = 2 * 1024 ** 3;
const IMAGE_MAX_BYTES = 20 * 1024 ** 2;

export type UploadPolicyResult =
  | { ok: true; kind: RawMediaKind }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function uploadErrorMessage(status: 400 | 401 | 500): string {
  if (status === 401) return "Faça login para enviar arquivos.";
  if (status === 400) return "Informe o nome e o formato do arquivo.";
  return "Não foi possível preparar o upload. Tente de novo.";
}

export function validateRawMediaUpload(contentType: string, sizeBytes: number): UploadPolicyResult {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, status: 400, error: "Tamanho de arquivo inválido." };
  }

  const kind = VIDEO_TYPES.has(contentType)
    ? "video"
    : IMAGE_TYPES.has(contentType)
      ? "image"
      : null;
  if (!kind) {
    return { ok: false, status: 415, error: "Formato não permitido." };
  }

  const maxBytes = kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: kind === "video" ? "O vídeo excede 2 GB." : "A foto excede 20 MB.",
    };
  }

  return { ok: true, kind };
}

const ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
export const ATTACHMENT_MAX_BYTES = 10 * 1024 ** 2;

export type AttachmentPolicyResult =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; error: string };

/** Chat attachment: few formats and a lower ceiling than raw video. */
export function validateChatAttachment(
  contentType: string,
  sizeBytes: number,
): AttachmentPolicyResult {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0)
    return { ok: false, status: 400, error: "Arquivo vazio ou inválido." };
  if (!ATTACHMENT_TYPES.has(contentType))
    return { ok: false, status: 415, error: "Anexe uma imagem (JPG, PNG, WebP) ou um PDF." };
  if (sizeBytes > ATTACHMENT_MAX_BYTES)
    return { ok: false, status: 413, error: "O anexo excede 10 MB." };
  return { ok: true };
}

/** Checks the leading bytes: the type declared by the browser is not enough. */
export function attachmentMatchesType(contentType: string, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (contentType) {
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp": // "RIFF" ???? "WEBP"
      return (
        starts(0x52, 0x49, 0x46, 0x46) &&
        head[8] === 0x57 &&
        head[9] === 0x45 &&
        head[10] === 0x42 &&
        head[11] === 0x50
      );
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46, 0x2d); // "%PDF-"
    default:
      return false;
  }
}
