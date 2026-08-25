import { NextResponse } from "next/server";
import { gerarUrlPresignada } from "@/lib/r2";
import { lerSessao } from "@/lib/sessao-servidor";

// Só vídeo: é o único tipo que os dois dropzones do app aceitam (bruto da
// missão e entrega do editor). Allowlist aqui porque o `accept` do input é
// conforto — some no primeiro curl. Antes desta lista, o presign aceitava
// QUALQUER MIME: um usuário logado podia transformar o bucket em hospedagem
// arbitrária (HTML, executável, o que fosse).
const MIME_ACEITOS = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
]);

// Mesmo teto que o cliente anuncia (2 GB), mas confirmado com assinatura:
// o tamanho vai assinado na URL presignada, e o R2 recusa corpo maior.
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

// Rate limit best-effort por usuário (janela deslizante de 1 hora). É em
// memória, então na Vercel cada instância fria conta do zero — não é muro,
// é pedregulho no caminho: encarece o abuso de storage sem migration nova.
// Se um dia precisar de muro de verdade, o lugar é uma tabela no Postgres.
const JANELA_MS = 60 * 60 * 1000;
const MAX_POR_HORA = 10;
const presignsPorUsuario = new Map<number, number[]>();

function estourouLimite(userId: number): boolean {
  const agora = Date.now();
  const marcas = (presignsPorUsuario.get(userId) ?? []).filter(
    (t) => agora - t < JANELA_MS
  );
  if (marcas.length >= MAX_POR_HORA) {
    presignsPorUsuario.set(userId, marcas);
    return true;
  }
  marcas.push(agora);
  presignsPorUsuario.set(userId, marcas);
  return false;
}

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  if (estourouLimite(sessao.id)) {
    return NextResponse.json(
      { erro: "Muitos uploads na última hora. Tenta de novo mais tarde." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const { filename, contentType, tamanho } = body ?? {};

  if (!filename || !contentType) {
    return NextResponse.json({ erro: "Faltando filename ou contentType" }, { status: 400 });
  }

  if (!MIME_ACEITOS.has(contentType)) {
    return NextResponse.json(
      { erro: "Só vídeo é aceito (MP4, MOV, AVI ou WebM)." },
      { status: 415 }
    );
  }

  // tamanho em bytes, obrigatório: é ele que viaja assinado na URL
  const tamanhoBytes = Number(tamanho);
  if (!Number.isInteger(tamanhoBytes) || tamanhoBytes <= 0) {
    return NextResponse.json({ erro: "Tamanho do arquivo ausente ou inválido." }, { status: 400 });
  }
  if (tamanhoBytes > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo maior que 2 GB." }, { status: 413 });
  }

  // Sanitizar o nome do arquivo para usar como key no R2 — sempre dentro da
  // pasta do próprio usuário, pra ninguém sobrescrever arquivo dos outros
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `uploads/${sessao.id}/${timestamp}-${safeFilename}`;

  try {
    const urls = await gerarUrlPresignada(key, contentType, tamanhoBytes);
    return NextResponse.json(urls);
  } catch (error) {
    console.error("Erro R2:", error);
    return NextResponse.json({ erro: "Falha ao gerar URL de upload" }, { status: 500 });
  }
}
