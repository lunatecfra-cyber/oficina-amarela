import { limitList, limitStr } from "@oficina/domain/limits";
import { NextResponse } from "next/server";
import { addMusicTrack, getAllMusicTags, listMusicTracks } from "@/lib/music-db";
import { generatePresignedUrl } from "@/lib/r2";
import { getSession } from "@/lib/server-session";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const PERMITTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/x-wav",
  "audio/wave",
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || undefined;

  const [tracks, tags] = await Promise.all([listMusicTracks(tag), getAllMusicTags()]);

  return NextResponse.json({ ok: true, tracks, musicas: tracks, tags });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );
  }
  if (session.role !== "editor" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only video editors may upload audio tracks.", erro: "Unauthorized." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Invalid form payload.", erro: "Invalid payload." },
      { status: 400 },
    );
  }

  const file = formData.get("file") ?? formData.get("arquivo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Please upload an audio file.", erro: "No audio file." },
      { status: 400 },
    );
  }

  if (!PERMITTED_AUDIO_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
    return NextResponse.json(
      { error: "Unsupported audio format. Use MP3, WAV, or OGG.", erro: "Unsupported format." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 4 MB maximum upload limit.", erro: "File too large." },
      { status: 400 },
    );
  }

  const title = limitStr((formData.get("title") ?? formData.get("nome")) as string | null, 120);
  if (!title) {
    return NextResponse.json(
      { error: "Please provide a track title.", erro: "Track title required." },
      { status: 400 },
    );
  }

  const rawTags = formData.get("tags") as string | null;
  const tags: string[] = rawTags
    ? limitList(
        rawTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        10,
      )
    : [];

  const contentType = file.type || "audio/mpeg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  let uploadUrl: string;
  let readUrl: string | null;
  try {
    ({ uploadUrl, readUrl } = await generatePresignedUrl(
      `music/${crypto.randomUUID()}-${safeName}`,
      contentType,
      file.size,
    ));
  } catch (error) {
    console.error("[music] R2 configuration failed", error);
    return NextResponse.json(
      { error: "Upload de áudio indisponível no momento." },
      { status: 503 },
    );
  }
  if (!readUrl) {
    return NextResponse.json({ error: "URL pública do áudio não configurada." }, { status: 503 });
  }
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  });
  if (!uploaded.ok) {
    console.error("[music] R2 upload failed", uploaded.status);
    return NextResponse.json({ error: "Não foi possível enviar o áudio." }, { status: 502 });
  }

  await addMusicTrack(title, tags, readUrl, file.size, session.id);

  return NextResponse.json({ ok: true });
}
