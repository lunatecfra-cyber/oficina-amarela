import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare global {
  var __r2Client: S3Client | undefined;
}

// Falha alta e cedo. Antes, credencial ausente virava placeholder silencioso
// ("COLOQUE_SEU_ACCOUNT_ID") e o erro só estourava lá na frente, como URL
// malformada guardada no banco. Sem R2 configurado o upload não existe —
// recusar na porta com mensagem clara é melhor que meia-funcionar.
//
// Lazy como o lib/db.ts: avaliar no top-level do módulo dispararia o throw
// durante o build do Next, que importa a rota só pra listar os handlers.
function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`R2 não configurado: falta ${nome} no ambiente.`);
  return valor;
}

function obterClient(): S3Client {
  if (globalThis.__r2Client) return globalThis.__r2Client;

  const accountId = exigirEnv("R2_ACCOUNT_ID");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: exigirEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: exigirEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  globalThis.__r2Client = client;
  return client;
}

const BUCKET = process.env.R2_BUCKET || "oficina-amarela-videos";

/**
 * URL presignada de escrita + URL pública de leitura.
 *
 * O tamanho entra ASSINADO no PUT: quem valida é o R2, não a gente. O
 * Content-Length assinado quebra a assinatura de qualquer upload com corpo
 * diferente do combinado (403), então o teto declarado no presign é teto de
 * verdade — sem isso, o limite ficava só no cliente, que some no curl.
 */
export async function gerarUrlPresignada(
  key: string,
  contentType: string,
  tamanhoBytes: number
) {
  const url = await getSignedUrl(
    obterClient(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: tamanhoBytes,
    }),
    { expiresIn: 3600 } // 1 hora de validade para o upload
  );

  // A URL de leitura vem de domínio público configurado — nunca de padrão
  // hardcode (o "pub-XXXXX" antigo era uma URL falsa indo pra coluna de
  // entrega no banco). Sem a env, o upload ainda funciona; o que falta é o
  // link público, e a rota avisa o cliente em vez de devolver mentira.
  const base = process.env.R2_PUBLIC_BASE_URL;
  const readUrl = base ? `${base.replace(/\/+$/, "")}/${key}` : null;

  return { uploadUrl: url, readUrl };
}
