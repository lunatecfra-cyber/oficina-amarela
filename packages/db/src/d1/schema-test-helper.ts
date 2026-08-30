import type { D1DatabaseLike } from "./types.ts";

export async function applyD1Schema(db: D1DatabaseLike, schema: string): Promise<void> {
  let statement = "";
  let trigger = false;

  for (const line of schema.replace(/^--.*$/gm, "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("CREATE TRIGGER")) trigger = true;
    statement += `${line}\n`;

    if ((!trigger && trimmed.endsWith(";")) || (trigger && trimmed === "END;")) {
      await db.prepare(statement).run();
      statement = "";
      trigger = false;
    }
  }

  if (statement.trim()) throw new Error("Incomplete D1 schema statement");
}
