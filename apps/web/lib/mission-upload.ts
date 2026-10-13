export async function uploadMissionVideo(
  file: File,
  missionId: string,
  progress: (percent: number) => void,
) {
  const base = `/api/missions/${missionId.replace(/^db-/, "")}`;
  const prepared = await fetch(`${base}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  });
  const upload = await prepared.json();
  if (!prepared.ok) throw new Error(upload.error ?? "Não foi possível preparar o vídeo.");
  if (!Number.isInteger(upload.chunkSize) || upload.chunkSize <= 0)
    throw new Error("Resposta de upload inválida.");
  const parts: { partNumber: number; etag: string }[] = [];
  for (let offset = 0; offset < file.size; offset += upload.chunkSize) {
    const partNumber = parts.length + 1;
    const response = await fetch(`${base}/files/${upload.fileId}/parts/${partNumber}`, {
      method: "PUT",
      headers: { "x-upload-id": upload.uploadId },
      body: file.slice(offset, offset + upload.chunkSize),
    });
    const part = await response.json();
    if (!response.ok) throw new Error(part.error ?? "Falha no envio do vídeo. Tente novamente.");
    parts.push(part);
    progress(
      Math.min(99, Math.round((Math.min(offset + upload.chunkSize, file.size) / file.size) * 100)),
    );
  }
  const response = await fetch(`${base}/files/${upload.fileId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploadId: upload.uploadId, parts }),
  });
  const completed = await response.json();
  if (!response.ok) throw new Error(completed.error ?? "Não foi possível concluir o envio.");
  progress(100);
  return completed.readUrl as string;
}
