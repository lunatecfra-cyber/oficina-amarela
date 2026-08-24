import { NextResponse } from "next/server";
import { gerarUrlPresignada } from "@/lib/r2";
import { lerSessao } from "@/lib/sessao-servidor";

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { filename, contentType } = body ?? {};

  if (!filename || !contentType) {
    return NextResponse.json({ erro: "Faltando filename ou contentType" }, { status: 400 });
  }

  // Sanitizar o nome do arquivo para usar como key no R2
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `uploads/${sessao.id}/${timestamp}-${safeFilename}`;

  try {
    const urls = await gerarUrlPresignada(key, contentType);
    return NextResponse.json(urls);
  } catch (error) {
    console.error("Erro R2:", error);
    return NextResponse.json({ erro: "Falha ao gerar URL de upload" }, { status: 500 });
  }
}
