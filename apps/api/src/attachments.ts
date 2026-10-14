import { attachmentMatchesType, validateChatAttachment } from "@oficina/domain/uploads";

export type PreparedAttachment = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
};

/**
 * Valida o arquivo recebido: formato e tamanho permitidos, bytes iniciais coerentes com o
 * tipo declarado, hash SHA-256 e um nome sem caminho nem caracteres de controle.
 */
export async function prepareAttachment(
  file: File,
): Promise<
  | { ok: true; attachment: PreparedAttachment }
  | { ok: false; status: 400 | 413 | 415; error: string }
> {
  const policy = validateChatAttachment(file.type, file.size);
  if (!policy.ok) return policy;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || !attachmentMatchesType(file.type, bytes))
    return { ok: false, status: 415, error: "O conteúdo não corresponde ao formato do arquivo." };
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const filename =
    [...(file.name.split(/[\\/]/).pop() ?? "")]
      .filter((ch) => ch.charCodeAt(0) > 31)
      .join("")
      .slice(0, 120) || "anexo";
  return {
    ok: true,
    attachment: { bytes, filename, contentType: file.type, size: file.size, sha256 },
  };
}

/** Download de anexo privado: imagem abre na página, PDF baixa; nada é interpretado como página. */
export function attachmentResponse(
  object: { body: unknown; size: number },
  meta: { contentType: string; filename: string },
) {
  const inline = meta.contentType.startsWith("image/");
  return new Response(object.body as never, {
    headers: {
      "content-type": meta.contentType,
      "content-length": String(object.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
