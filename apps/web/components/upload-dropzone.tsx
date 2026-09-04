"use client";

import { useRef, useState } from "react";

export type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadDropzoneProps {
  label?: string;
  onUploadSuccess: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
}

export function UploadDropzone({
  label = "Vídeo bruto",
  onUploadSuccess,
  accept = "video/mp4,video/quicktime,video/x-msvideo,video/webm",
  maxSizeMB = 2000,
  multiple = false,
}: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setState("error");
      setErrorMessage(`Arquivo muito grande. Máximo: ${maxSizeMB} MB.`);
      return;
    }

    setFileName(file.name);
    setFileSize(formatSize(file.size));
    setState("uploading");
    setProgress(0);
    setErrorMessage("");

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          tamanho: file.size,
        }),
      });

      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null);
        throw new Error(body?.error || body?.erro || "Erro ao preparar upload");
      }
      const { uploadUrl, readUrl } = await presignRes.json();
      if (!readUrl) {
        throw new Error("Upload sem URL pública configurada no servidor (R2_PUBLIC_BASE_URL).");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Falha no upload: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede no upload"));
        xhr.send(file);
      });

      setState("success");
      onUploadSuccess(readUrl);
      if (multiple) {
        setState("idle");
        setFileName("");
        setProgress(0);
      }
    } catch (err: unknown) {
      console.error(err);
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Ocorreu um erro no upload");
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) await handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(multiple ? e.dataTransfer.files : [e.dataTransfer.files[0]]);
    }
  };

  return (
    <div
      className={`relative mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 
        ${
          state === "uploading"
            ? "border-gold/50 bg-gold/5"
            : state === "success"
              ? "border-ok/50 bg-ok/5"
              : state === "error"
                ? "border-danger/50 bg-danger/5"
                : isDragging
                  ? "border-gold bg-gold/10"
                  : "border-line bg-surface/50 hover:border-silver-lo hover:bg-surface"
        }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => {
        if (state !== "uploading" && (state !== "success" || multiple)) {
          fileInputRef.current?.click();
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && state !== "uploading") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {state === "idle" && (
        <>
          <div className="mb-4 rounded-full bg-surface-2 p-4">
            <svg
              className="h-8 w-8 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-text">{label}</p>
          <p className="mt-1 text-sm text-muted">
            Arraste {multiple ? "os vídeos" : "o vídeo"} aqui ou clique para escolher
          </p>
          <p className="mt-2 text-xs text-silver-lo">
            Máx. {maxSizeMB > 1000 ? `${(maxSizeMB / 1000).toFixed(1)} GB` : `${maxSizeMB} MB`}{" "}
            por arquivo &middot; MP4, MOV, AVI, WebM
          </p>
        </>
      )}

      {state === "uploading" && (
        <div className="w-full max-w-sm">
          <p className="font-medium text-gold">{fileName}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-silver-lo">
            <span>{fileSize}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-gold transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {state === "success" && (
        <div className="flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2 text-ok">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{fileName}</span>
          </div>
          <p className="text-xs text-muted">{fileSize} &middot; Enviado</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setState("idle");
              setFileName("");
              setProgress(0);
            }}
            className="mt-4 text-sm font-medium text-gold transition-colors hover:text-danger"
          >
            Substituir arquivo
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center">
          <svg
            className="mb-2 h-8 w-8 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-danger">{errorMessage}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setState("idle");
              setErrorMessage("");
            }}
            className="mt-4 rounded border border-danger/30 bg-danger/10 px-4 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
