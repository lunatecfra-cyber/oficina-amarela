"use client";

import { LIMITS } from "@oficina/domain/limits";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Review = { rating: number; comment: string | null; version: number; voidedAt: string | null };

export function MissionReview({ id, deliveryVersion }: { id: string; deliveryVersion: number }) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/missions/${id}/review`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar sua avaliação. Atualize a página.");
        const data = await response.json();
        if (active) {
          setReview(data.review);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === null || sending || loading) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment, expectedDeliveryVersion: deliveryVersion }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Não foi possível salvar. Tente novamente.");
      }
      setReview({
        rating,
        comment: comment.trim() || null,
        version: deliveryVersion,
        voidedAt: null,
      });
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Sua avaliação do editor"
      className="mb-8 rounded-2xl border border-line-soft p-5"
    >
      <h2 className="font-medium">Sua avaliação do editor</h2>
      <p className="mt-2 text-sm text-muted">
        Avalie o serviço concluído. A fiscalização técnica é independente desta nota; nenhuma nota é
        atribuída automaticamente.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-3 text-sm text-muted">Carregando avaliação…</p>
      ) : review ? (
        <div className="mt-3">
          <p>
            {review.rating} de 5 estrelas · versão {review.version}
            {review.voidedAt ? " · avaliação anulada" : " · avaliação registrada"}
          </p>
          {review.comment && <p className="mt-2 whitespace-pre-line text-sm">{review.comment}</p>}
        </div>
      ) : (
        <form className="mt-4" onSubmit={submit}>
          <fieldset disabled={sending}>
            <legend className="text-sm">Como foi trabalhar com o editor?</legend>
            <div className="mt-2 flex gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    required
                  />
                  {value} ★
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm" htmlFor={`review-comment-${id}`}>
              Comentário opcional
            </label>
            <textarea
              id={`review-comment-${id}`}
              className="field-input mt-2 min-h-24 !pl-4"
              maxLength={LIMITS.longText}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </fieldset>
          <button className="btn-gold mt-3" disabled={rating === null || sending}>
            {sending ? "Salvando…" : "Enviar avaliação"}
          </button>
        </form>
      )}
    </section>
  );
}
