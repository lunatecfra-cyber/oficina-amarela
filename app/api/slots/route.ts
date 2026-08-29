import { NextResponse } from "next/server";
import { countEnrolledByRole } from "@/lib/accounts";
import { ROLE_LIMITS } from "@/lib/limits";

export async function GET() {
  const [totalEditors, totalSpokespersons] = await Promise.all([
    countEnrolledByRole("editor"),
    countEnrolledByRole("spokesperson"),
  ]);

  return NextResponse.json({
    editor: {
      total: ROLE_LIMITS.editor,
      enrolled: totalEditors,
      inscritos: totalEditors,
      free: Math.max(0, ROLE_LIMITS.editor - totalEditors),
      livres: Math.max(0, ROLE_LIMITS.editor - totalEditors),
    },
    spokesperson: {
      total: ROLE_LIMITS.spokesperson,
      enrolled: totalSpokespersons,
      inscritos: totalSpokespersons,
      free: Math.max(0, ROLE_LIMITS.spokesperson - totalSpokespersons),
      livres: Math.max(0, ROLE_LIMITS.spokesperson - totalSpokespersons),
    },
    voz: {
      total: ROLE_LIMITS.spokesperson,
      enrolled: totalSpokespersons,
      inscritos: totalSpokespersons,
      free: Math.max(0, ROLE_LIMITS.spokesperson - totalSpokespersons),
      livres: Math.max(0, ROLE_LIMITS.spokesperson - totalSpokespersons),
    },
  });
}
