"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVEL_LABEL } from "@/lib/lesson-labels";
import type { LessonDetail } from "@/lib/lessons-db";

async function putProgress(id: number, completed: boolean) {
  return fetch(`/api/lessons/${id}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completed ? { completed: true } : {}),
  });
}

export function LessonPlayer({ lesson }: { lesson: LessonDetail }) {
  const router = useRouter();
  const [completedAt, setCompletedAt] = useState(lesson.completedAt);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");

  // Opening a lesson is what feeds "Continue assistindo". Completion is explicit:
  // the embedded player exposes no playback events to this page.
  useEffect(() => {
    void putProgress(lesson.id, false).catch(() => undefined);
  }, [lesson.id]);

  async function complete() {
    setSaving(true);
    setWarning("");
    const resp = await putProgress(lesson.id, true).catch(() => null);
    setSaving(false);
    if (!resp?.ok) return setWarning("Não deu pra salvar. Tente de novo.");
    const body = (await resp.json()) as { completedAt: string };
    setCompletedAt(body.completedAt);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-8 lg:py-12">
      <Link
        href="/aulas"
        className="tap-target inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold-hi"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Todas as aulas
      </Link>

      <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-muted">
        {lesson.trackTitle} · {lesson.moduleTitle}
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        {lesson.title}
      </h1>
      <p className="mt-2 text-xs text-muted">
        {[
          lesson.category,
          LEVEL_LABEL[lesson.level],
          lesson.durationMinutes ? `${lesson.durationMinutes} min` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-line bg-ink-2">
        <iframe
          src={lesson.videoUrl}
          title={lesson.title}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {lesson.description && (
        <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted">
          {lesson.description}
        </p>
      )}

      <div className="mt-8">
        {completedAt ? (
          <p className="flex items-center gap-2 text-sm text-ok">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Aula concluída
          </p>
        ) : (
          <button
            type="button"
            className="btn-gold w-full sm:w-64"
            onClick={complete}
            disabled={saving}
          >
            {saving ? "Salvando…" : "Marcar como concluída"}
          </button>
        )}
        {warning && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {warning}
          </p>
        )}
      </div>
    </div>
  );
}
