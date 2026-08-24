import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "COLOQUE_SEU_ACCOUNT_ID";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "COLOQUE_SUA_ACCESS_KEY";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "COLOQUE_SEU_SECRET";

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function gerarUrlPresignada(key: string, contentType: string) {
  const url = await getSignedUrl(
    S3,
    new PutObjectCommand({
      Bucket: "oficina-amarela-videos", // Substitua pelo nome real do bucket R2 no dashboard
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 } // 1 hora de validade para o upload
  );
  
  // No R2, você pode ter o domínio público ligado ao bucket para acessar.
  // URL final para ler o vídeo depois (supondo que o bucket seja público via dev domain)
  const readUrl = `https://pub-XXXXXXXXXXX.r2.dev/${key}`;

  return { uploadUrl: url, readUrl };
}
