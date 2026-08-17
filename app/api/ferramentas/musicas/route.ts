import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { lerSessao } from "@/lib/sessao-servidor";
import { listarMusicas, adicionarMusica, todasAsTags } from "@/lib/musicas-db";
import { limitar, limitarLista } from "@/lib/limites";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const TAMANHO_MAXIMO = 4 * 1024 * 1024; // 4MB (limite do plano grátis Vercel Blob)
const TIPOS_PERMITIDOS = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/x-wav",
  "audio/wave",
]);

export async function GET(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || undefined;

  const [musicas, tags] = await Promise.all([listarMusicas(tag), todasAsTags()]);

  return NextResponse.json({ ok: true, musicas, tags });
}

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }
  if (sessao.papel !== "editor" && sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Só editores podem adicionar músicas." },
      { status: 403 }
    );
  }

  if (!BLOB_TOKEN) {
    return NextResponse.json(
      { erro: "Upload indisponível no momento." },
      { status: 503 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Envie um arquivo de áudio." }, { status: 400 });
  }

  if (!TIPOS_PERMITIDOS.has(arquivo.type) && !arquivo.name.match(/\.(mp3|wav|ogg)$/i)) {
    return NextResponse.json(
      { erro: "Formato não suportado. Use MP3, WAV ou OGG." },
      { status: 400 }
    );
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: "Arquivo muito grande. Máximo 4 MB." },
      { status: 400 }
    );
  }

  const nome = limitar(formData.get("nome") as string | null, 120);
  if (!nome) {
    return NextResponse.json({ erro: "Dê um nome à música." }, { status: 400 });
  }

  const tagsRaw = formData.get("tags") as string | null;
  const tags: string[] = tagsRaw
    ? limitarLista(
        tagsRaw
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        10
      )
    : [];

  // upload no Vercel Blob
  const blob = await put(`musicas/${arquivo.name}`, arquivo, {
    access: "public",
    contentType: arquivo.type || "audio/mpeg",
    token: BLOB_TOKEN,
  });

  await adicionarMusica(nome, tags, blob.url, arquivo.size, sessao.id);

  return NextResponse.json({ ok: true });
}
