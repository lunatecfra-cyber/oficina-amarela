import { NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { readSession } from "@/lib/server-session";

const ACCEPTED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
]);

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;
const presignsByUser = new Map<number, number[]>();

function hasExceededUploadLimit(userId: number): boolean {
  const now = Date.now();
  const stamps = (presignsByUser.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_HOUR) {
    presignsByUser.set(userId, stamps);
    return true;
  }
  stamps.push(now);
  presignsByUser.set(userId, stamps);
  return false;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );
  }

  if (hasExceededUploadLimit(session.id)) {
    return NextResponse.json(
      {
        error: "Too many uploads in the past hour. Please try again later.",
        erro: "Rate limited.",
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
