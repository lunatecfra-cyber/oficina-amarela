"use client";
import type { PortfolioSample } from "@oficina/domain/portfolio";
import { useState } from "react";

export function PortfolioSamplePreview({ sample }: { sample: PortfolioSample }) {
  const [error, setError] = useState(false);
  const src = `/api/portfolio/${sample.id}/media`;
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
      {error ? (
        <p role="status" className="p-4 text-sm text-muted">
          Prévia indisponível. A autorização pode ter sido revogada.
        </p>
      ) : sample.mediaKind === "image" ? (
        <img
          src={src}
          alt={sample.title}
          loading="lazy"
          className="aspect-video w-full object-contain bg-black"
          onError={() => setError(true)}
        />
      ) : (
        <video
          src={`${src}#t=${sample.previewSeconds}`}
          controls
          playsInline
          preload="metadata"
          aria-label={`Prévia de ${sample.title}`}
          className="aspect-video w-full bg-black"
          onError={() => setError(true)}
        >
          <track kind="captions" />
        </video>
      )}
      <figcaption className="p-4">
        <h3 className="break-words font-semibold text-text">{sample.title}</h3>
        {sample.description && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
            {sample.description}
          </p>
        )}
        {sample.specialties && (
          <p className="mt-2 break-words text-xs text-gold-hi">{sample.specialties}</p>
        )}
      </figcaption>
    </figure>
  );
}
