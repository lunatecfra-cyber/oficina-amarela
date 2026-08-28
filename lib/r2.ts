import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare global {
  var __r2Client: S3Client | undefined;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`R2 not configured: missing ${name} in environment.`);
  return val;
}

function getClient(): S3Client {
  if (globalThis.__r2Client) return globalThis.__r2Client;

  const accountId = requireEnv("R2_ACCOUNT_ID");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  globalThis.__r2Client = client;
  return client;
}

const BUCKET = process.env.R2_BUCKET || "yellow-workshop-videos";

export async function generatePresignedUrl(
  key: string,
  contentType: string,
  sizeBytes: number
) {
  const url = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    }),
    { expiresIn: 3600 }
  );

  const base = process.env.R2_PUBLIC_BASE_URL;
  const readUrl = base ? `${base.replace(/\/+$/, "")}/${key}` : null;

  return { uploadUrl: url, readUrl };
}

export const generatePresignedUploadUrl = generatePresignedUrl;
