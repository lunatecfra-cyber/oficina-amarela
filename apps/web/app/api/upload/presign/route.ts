import { NextResponse } from "next/server";
import { fetchApi } from "@/lib/internal-api";
import { generatePresignedUrl } from "@/lib/r2";
import { getSession } from "@/lib/server-session";
import { uploadErrorMessage, validateRawMediaUpload } from "@/lib/upload-policy";

const WINDOW_MINUTES = 60;
const MAX_PER_HOUR = 20;

const uploadKey = (userId: number) => `presign:${userId}`;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: uploadErrorMessage(401), erro: uploadErrorMessage(401) },
      { status: 401 },
    );
  }

  const limitRes = await fetchApi("/auth/rate-limit/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: uploadKey(session.id) }),
  });
  const limit = (await limitRes.json().catch(() => ({ locked: false }))) as { locked?: boolean };

  if (limit?.locked) {
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
      { error: uploadErrorMessage(400), erro: uploadErrorMessage(400) },
      { status: 400 },
    );
  }

  const sizeBytes = Number(size);
  const policy = validateRawMediaUpload(contentType, sizeBytes);
  if (!policy.ok) {
    return NextResponse.json(
      { error: policy.error, erro: policy.error },
      { status: policy.status },
    );
  }

  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `uploads/${session.id}/${timestamp}-${safeFilename}`;

  try {
    const urls = await generatePresignedUrl(key, contentType, sizeBytes);
    await fetchApi("/auth/rate-limit/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: uploadKey(session.id),
        max: MAX_PER_HOUR,
        windowMinutes: WINDOW_MINUTES,
        lockMinutes: WINDOW_MINUTES,
      }),
    });
    return NextResponse.json({ ...urls, kind: policy.kind });
  } catch (error) {
    console.error("R2 presign error:", error);
    return NextResponse.json(
      { error: uploadErrorMessage(500), erro: uploadErrorMessage(500) },
      { status: 500 },
    );
  }
}
