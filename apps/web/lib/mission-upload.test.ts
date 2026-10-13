import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadMissionVideo } from "./mission-upload.ts";

test("upload só conclui após todas as partes e confirmação do R2", async (t) => {
  const progress: number[] = [];
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    paths.push(url);
    if (url.endsWith("/uploads"))
      return Response.json({ fileId: "file", uploadId: "upload", chunkSize: 2 });
    if (url.endsWith("/complete")) {
      assert.equal(JSON.parse(String(init.body)).parts.length, 3);
      return Response.json({ readUrl: "https://staging.local/private-video" });
    }
    assert.equal(await (init.body as Blob).text(), "ab");
    return Response.json({ partNumber: Number(url.split("/").at(-1)), etag: "etag" });
  });
  const result = await uploadMissionVideo(
    new File(["ababab"], "synthetic.mp4", { type: "video/mp4" }),
    "db-38",
    (p) => progress.push(p),
  );
  assert.equal(result, "https://staging.local/private-video");
  assert.equal(paths.length, 5);
  assert.deepEqual(progress, [33, 67, 99, 100]);
});
test("falha em uma parte impede confirmação e progresso de sucesso", async (t) => {
  const paths: string[] = [],
    progress: number[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    paths.push(url);
    return url.endsWith("/uploads")
      ? Response.json({ fileId: "file", uploadId: "upload", chunkSize: 2 })
      : Response.json({ error: "Falha simulada" }, { status: 503 });
  });
  await assert.rejects(
    uploadMissionVideo(new File(["ab"], "synthetic.mp4", { type: "video/mp4" }), "db-38", (p) =>
      progress.push(p),
    ),
    /Falha simulada/,
  );
  assert.equal(
    paths.some((path) => path.endsWith("/complete")),
    false,
  );
  assert.equal(progress.includes(100), false);
});
