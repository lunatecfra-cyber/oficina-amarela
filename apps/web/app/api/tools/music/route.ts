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
      { error: "Faça login para continuar.", erro: "Faça login para continuar." },
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
      { error: "Faça login para continuar.", erro: "Faça login para continuar." },
      { status: 401 },
    );
  }
  if (session.role !== "editor" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Somente editores podem enviar faixas de áudio.", erro: "Sem permissão." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Os dados enviados são inválidos.", erro: "Dados inválidos." },
      { status: 400 },
    );
  }

  const file = formData.get("file") ?? formData.get("arquivo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie um arquivo de áudio.", erro: "Arquivo de áudio não informado." },
      { status: 400 },
    );
  }

  if (!PERMITTED_AUDIO_TYPES.has(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
    return NextResponse.json(
      { error: "Formato não aceito. Use MP3, WAV ou OGG.", erro: "Formato não aceito." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "O arquivo ultrapassa o limite de 4 MB.", erro: "Arquivo muito grande." },
      { status: 400 },
    );
  }

  const title = limitStr((formData.get("title") ?? formData.get("nome")) as string | null, 120);
  if (!title) {
    return NextResponse.json(
      { error: "Informe o título da faixa.", erro: "Título obrigatório." },
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
