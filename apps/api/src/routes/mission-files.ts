import type { R2Bucket } from "@cloudflare/workers-types";
import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { hasCapability } from "@oficina/domain/roles";
import { validateRawMediaUpload } from "@oficina/domain/uploads";
import { Hono, type MiddlewareHandler } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireSession } from "../session.ts";

const CHUNK_SIZE = 5 * 1024 ** 2;
const UUID = /^[a-f0-9-]{36}$/;
type FileEnv = { Bindings: Bindings; Variables: { session: UserSession; requestId: string } };

export function createMissionFileRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<FileEnv>();
  routes.use("/:id/uploads", requireSession);
  routes.use("/:id/files/*", requireSession);
  const authorize: MiddlewareHandler<FileEnv> = async (c, next) => {
    if (!c.env.DB || !c.env.MEDIA)
      return c.json({ error: "Armazenamento de vídeo indisponível." }, 503);
    const mission = await (c.env.DB as D1DatabaseLike)
      .prepare("SELECT spokesperson_id,reserved_by_id,status FROM missions WHERE id=?")
      .bind(Number(c.req.param("id")))
      .first<{ spokesperson_id: number; reserved_by_id: number | null; status: string }>();
    const actor = c.get("session");
    const inspectionRead =
      actor.role === "inspector" &&
      hasCapability(actor, "mission.read") &&
      hasCapability(actor, "mission.inspect") &&
      c.req.method === "GET" &&
      Boolean(
        await (c.env.DB as D1DatabaseLike)
          .prepare(`SELECT m.id FROM missions m JOIN mission_deliveries current ON current.mission_id=m.id AND current.version=m.delivery_version
        JOIN mission_deliveries d ON d.mission_id=m.id WHERE m.id=? AND (SELECT inspector_id FROM mission_inspection_assignments WHERE mission_id=current.mission_id AND version=current.version)=? AND current.editor_id<>?
        AND d.delivery_video_url=?`)
          .bind(
            Number(c.req.param("id")),
            actor.id,
            actor.id,
            `${c.env.PUBLIC_ORIGIN ?? new URL(c.req.url).origin}/api${new URL(c.req.url).pathname}`,
          )
          .first(),
      );
    if (
      !mission ||
      (!(actor.role === "admin" && hasCapability(actor, "mission.read")) &&
        !inspectionRead &&
        (actor.role === "inspector" ||
          (mission.reserved_by_id !== actor.id && mission.spokesperson_id !== actor.id)))
    )
      return c.json({ error: "Você não participa desta missão." }, 403);
    if (
      c.req.method !== "GET" &&
      (actor.role !== "editor" ||
        mission.reserved_by_id !== actor.id ||
        !["reservada", "reedicao"].includes(mission.status))
    )
      return c.json({ error: "Essa missão não está com você para entrega." }, 403);
    await next();
  };
  routes.use("/:id/uploads", authorize);
  routes.use("/:id/files/*", authorize);
  routes.post("/:id/uploads", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (
      typeof body?.filename !== "string" ||
      !body.filename.trim() ||
      body.filename.length > 180 ||
      typeof body?.contentType !== "string"
    )
      return c.json({ error: "Informe o nome e o formato do vídeo." }, 400);
    const policy = validateRawMediaUpload(body.contentType, body.size);
    if (!policy.ok) return c.json({ error: policy.error }, policy.status);
    if (policy.kind !== "video") return c.json({ error: "A entrega deve ser um vídeo." }, 415);
    const attempt = await dependencies.accounts.recordAttempt(
      `presign:${c.get("session").id}`,
      20,
      60,
      60,
    );
    if (attempt.locked)
      return c.json({ error: "Muitos envios na última hora. Tente de novo mais tarde." }, 429);
    const fileId = crypto.randomUUID();
    const ownerId = c.get("session").id;
    const key = `missions/${Number(c.req.param("id"))}/${ownerId}/${fileId}`;
    const upload = await c.env.MEDIA!.createMultipartUpload(key, {
      httpMetadata: { contentType: body.contentType },
      customMetadata: {
        filename: body.filename,
        ownerId: String(ownerId),
        missionId: c.req.param("id"),
        expectedSize: String(body.size),
      },
    });
    return c.json({ fileId, uploadId: upload.uploadId, chunkSize: CHUNK_SIZE });
  });
  routes.put("/:id/files/:fileId/parts/:part", async (c) => {
    const fileId = c.req.param("fileId"),
      part = Number(c.req.param("part"));
    const uploadId = c.req.header("x-upload-id");
    if (
      !UUID.test(fileId) ||
      !Number.isInteger(part) ||
      part < 1 ||
      part > 410 ||
      !uploadId ||
      uploadId.length > 1024
    )
      return c.json({ error: "Parte de upload inválida." }, 400);
    const bytes = await c.req.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > CHUNK_SIZE)
      return c.json({ error: "Parte excede 5 MB." }, 413);
    const key = `missions/${Number(c.req.param("id"))}/${c.get("session").id}/${fileId}`;
    return c.json(await c.env.MEDIA!.resumeMultipartUpload(key, uploadId).uploadPart(part, bytes));
  });
  routes.post("/:id/files/:fileId/complete", async (c) => {
    const fileId = c.req.param("fileId"),
      actor = c.get("session");
    const body = await c.req.json().catch(() => null);
    if (
      !UUID.test(fileId) ||
      typeof body?.uploadId !== "string" ||
      !Array.isArray(body.parts) ||
      !body.parts.length ||
      body.parts.length > 410 ||
      body.parts.some(
        (part: { partNumber: number; etag: string }, i: number) =>
          !part || part.partNumber !== i + 1 || typeof part.etag !== "string",
      )
    )
      return c.json({ error: "Conclusão de upload inválida." }, 400);
    const key = `missions/${Number(c.req.param("id"))}/${actor.id}/${fileId}`;
    let object = await c.env.MEDIA!.head(key);
    if (!object) {
      await c.env.MEDIA!.resumeMultipartUpload(key, body.uploadId).complete(body.parts);
      object = await c.env.MEDIA!.head(key);
    }
    if (
      !object ||
      object.size !== Number(object.customMetadata?.expectedSize) ||
      object.customMetadata?.ownerId !== String(actor.id)
    )
      return c.json({ error: "O arquivo não corresponde ao upload solicitado." }, 409);
    return c.json({
      readUrl: new URL(
        `/api/missions/${Number(c.req.param("id"))}/files/${actor.id}/${fileId}`,
        c.req.url,
      ).href,
      size: object.size,
    });
  });
  routes.get("/:id/files/:ownerId/:fileId", async (c) => {
    const fileId = c.req.param("fileId"),
      ownerId = Number(c.req.param("ownerId"));
    if (!UUID.test(fileId) || !Number.isInteger(ownerId) || ownerId <= 0)
      return c.json({ error: "Arquivo inválido." }, 400);
    const key = `missions/${Number(c.req.param("id"))}/${ownerId}/${fileId}`;
    return readMissionMedia(c.env.MEDIA!, key, c.req.header("range"));
  });
  return routes;
}

export async function readMissionMedia(bucket: R2Bucket, key: string, range?: string) {
  const metadata = await bucket.head(key);
  if (!metadata || metadata.size !== Number(metadata.customMetadata?.expectedSize))
    return Response.json({ error: "Vídeo não encontrado ou incompleto." }, { status: 404 });
  let offset = 0,
    length = metadata.size;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: {
          "content-range": `bytes */${metadata.size}`,
          "cache-control": "private, no-store",
        },
      });
    offset = match[1] ? Number(match[1]) : Math.max(0, metadata.size - Number(match[2]));
    const end = match[1] && match[2] ? Number(match[2]) : metadata.size - 1;
    if (offset >= metadata.size || end < offset)
      return new Response(null, {
        status: 416,
        headers: {
          "content-range": `bytes */${metadata.size}`,
          "cache-control": "private, no-store",
        },
      });
    length = Math.min(end, metadata.size - 1) - offset + 1;
  }
  const object = await bucket.get(key, range ? { range: { offset, length } } : undefined);
  if (!object) return Response.json({ error: "Vídeo não encontrado." }, { status: 404 });
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? "video/mp4",
    "cache-control": "private, no-store",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  });
  if (range) {
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body as never, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body as never, { headers });
}
