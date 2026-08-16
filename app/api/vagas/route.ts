import { NextResponse } from "next/server";
import { contarInscritos } from "@/lib/contas";
import { VAGAS } from "@/lib/limites";

// Público — qualquer um pode ver quantas vagas restam.
// A informação é volunária: serve pra criar senso de escassez e urgência
// sem revelar dados sensíveis de quem já está inscrito.
export async function GET() {
  const [totalEditores, totalVoz] = await Promise.all([
    contarInscritos("editor"),
    contarInscritos("voz"),
  ]);

  return NextResponse.json({
    editor: {
      total: VAGAS.editor,
      inscritos: totalEditores,
      livres: Math.max(0, VAGAS.editor - totalEditores),
    },
    voz: {
      total: VAGAS.voz,
      inscritos: totalVoz,
      livres: Math.max(0, VAGAS.voz - totalVoz),
    },
  });
}
