import { NextResponse } from "next/server";
import { isRateLocked, recordAttempt } from "@/lib/accounts";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { readSession } from "@/lib/server-session";

const ACCEPTED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
]);

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// O limite mora no banco, não em memória de processo: um Map de módulo vive por
// isolate, e nos Workers isso significa um contador novo a cada isolate criado —
// na prática, limite nenhum.
const WINDOW_MINUTES = 60;
const MAX_PER_HOUR = 10;

const uploadKey = (userId: number) => `presign:${userId}`;

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );
  }

  const limit = await isRateLocked(uploadKey(session.id));
  if (limit.locked) {
    return NextResponse.json(
      {
        error: "Muitos envios na última hora. Tente de novo mais tarde.",
        erro: "Muitos envios na última hora. Tente de novo mais tarde.",
      },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const filename = body?.filename;
  const contentType = body?.contentType;
  const size = body?.size ?? body?.tamanho;

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Missing filename or contentType parameter.", erro: "Missing parameters." },
      { status: 400 },
    );
  }

  if (!ACCEPTED_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      {
        error: "Only video media formats are accepted (MP4, MOV, AVI, WebM).",
        erro: "Unsupported format.",
      },
      { status: 415 },
    );
  }

  const sizeBytes = Number(size);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid file byte size.", erro: "Invalid size." },
      { status: 400 },
    );
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds max 2 GB limit.", erro: "File too large." },
      { status: 413 },
    );
  }

  await recordAttempt(uploadKey(session.id), MAX_PER_HOUR, WINDOW_MINUTES, WINDOW_MINUTES);

  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `uploads/${session.id}/${timestamp}-${safeFilename}`;

  try {
    const urls = await generatePresignedUploadUrl(key, contentType, sizeBytes);
    return NextResponse.json(urls);
  } catch (error) {
    console.error("R2 presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned upload URL.", erro: "Presign failure." },
      { status: 500 },
    );
  }
}
