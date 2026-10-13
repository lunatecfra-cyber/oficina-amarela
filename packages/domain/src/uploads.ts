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
