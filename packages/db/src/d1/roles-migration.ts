import type { D1DatabaseLike } from "./types.ts";

export async function expandInspectorRole(db: D1DatabaseLike) {
  const table = await db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .first<{ sql: string }>();
  if (!table || table.sql.includes("'inspector'")) return;
  if (!db.batch) throw new Error("Role migration requires an atomic D1 batch");
  const { results } = await db
    .prepare(
      "SELECT type,name,sql FROM sqlite_master WHERE type IN ('trigger','view','index') AND sql IS NOT NULL",
    )
    .all<{ type: string; name: string; sql: string }>();
  const dependent = results.filter(
    (object) => object.type !== "index" || /\brole\b/.test(object.sql),
  );
  const statements = inspectorRoleStatements(dependent);
  // Keep the parent table and every child row; rebuilding users would cascade-delete evidence.
  await db.batch(statements.map((statement) => db.prepare(statement)));
}

export function inspectorRoleStatements(dependent: { type: string; name: string; sql: string }[]) {
  return [
    ...dependent.map(
      (object) => `DROP ${object.type.toUpperCase()} "${object.name.replaceAll('"', '""')}"`,
    ),
    "ALTER TABLE users ADD COLUMN role_next TEXT NOT NULL DEFAULT 'editor' CHECK(role_next IN ('voz','editor','admin','inspector'))",
    "UPDATE users SET role_next=role",
    "ALTER TABLE users DROP COLUMN role",
    "ALTER TABLE users RENAME COLUMN role_next TO role",
    ...dependent.map((object) => object.sql),
  ];
}
