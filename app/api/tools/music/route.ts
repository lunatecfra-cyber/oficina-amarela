import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { readSession } from "@/lib/server-session";
import { listMusicTracks, addMusicTrack, allMusicTags } from "@/lib/music-db";
import { limitString, limitList } from "@/lib/limits";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
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
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || undefined;

  const [tracks, tags] = await Promise.all([listMusicTracks(tag), allMusicTags()]);

  return NextResponse.json({ ok: true, tracks, musicas: tracks, tags });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  }
  if (session.role !== "editor" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only video editors may upload audio tracks.", erro: "Unauthorized." },
      { status: 403 }
    );
  }

  if (!BLOB_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage upload currently unconfigured.", erro: "Upload unavailable." },
      { status: 503 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form payload.", erro: "Invalid payload." }, { status: 400 });
  }

  const file = formData.get("file") ?? formData.get("arquivo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload an audio file.", erro: "No audio file." }, { status: 400 });
  }

  if (!PERMITTED_AUDIO_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
    return NextResponse.json(
      { error: "Unsupported audio format. Use MP3, WAV, or OGG.", erro: "Unsupported format." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 4 MB maximum upload limit.", erro: "File too large." },
      { status: 400 }
    );
  }

  const title = limitString((formData.get("title") ?? formData.get("nome")) as string | null, 120);
  if (!title) {
    return NextResponse.json({ error: "Please provide a track title.", erro: "Track title required." }, { status: 400 });
  }

  const rawTags = formData.get("tags") as string | null;
  const tags: string[] = rawTags
    ? limitList(
        rawTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        10
      )
    : [];

  const blob = await put(`music/${file.name}`, file, {
    access: "public",
    contentType: file.type || "audio/mpeg",
    token: BLOB_TOKEN,
  });

  await addMusicTrack(title, tags, blob.url, file.size, session.id);

  return NextResponse.json({ ok: true });
}
