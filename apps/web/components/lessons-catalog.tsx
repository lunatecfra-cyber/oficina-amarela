"use client";

import { CheckCircle2, Clock, GraduationCap, PlayCircle, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LEVEL_LABEL, type LessonSummary } from "@/lib/lessons-db";

// ponytail: filtering runs in the browser over the whole published list; move it
// to the API (and paginate) when the catalog grows past a few hundred lessons.
const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function LessonCard({ lesson }: { lesson: LessonSummary }) {
  const done = Boolean(lesson.completedAt);
  const started = Boolean(lesson.lastOpenedAt) && !done;
  return (
    <Link
      href={`/aulas/${lesson.id}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-gold-lo/60"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted">
        {lesson.category && <span className="truncate text-gold">{lesson.category}</span>}
        <span className="ml-auto flex-none">{LEVEL_LABEL[lesson.level]}</span>
      </div>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-semibold text-text group-hover:text-gold-hi">
        {lesson.title}
      </h3>
      {lesson.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{lesson.description}</p>
      )}
      <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted">
        {lesson.durationMinutes && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {lesson.durationMinutes} min
          </span>
        )}
        {done ? (
          <span className="ml-auto flex items-center gap-1 text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Concluída
          </span>
        ) : started ? (
          <span className="ml-auto flex items-center gap-1 text-gold">
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Em andamento
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function Grid({ lessons }: { lessons: LessonSummary[] }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}

export function LessonsCatalog({ lessons }: { lessons: LessonSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");

  const categories = useMemo(
    () =>
      [...new Set(lessons.map((lesson) => lesson.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [lessons],
  );
  const filtering = Boolean(query.trim() || category || level);
  const matches = useMemo(() => {
    const needle = fold(query.trim());
    return lessons.filter(
      (lesson) =>
        (!category || lesson.category === category) &&
        (!level || lesson.level === level) &&
        (!needle || fold(`${lesson.title} ${lesson.description}`).includes(needle)),
    );
  }, [lessons, query, category, level]);

  if (lessons.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div className="px-6 py-14 text-center lg:py-20">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold-lo/40 bg-gold/[0.06]">
            <GraduationCap className="h-6 w-6 text-gold" aria-hidden="true" />
          </span>
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            Em breve
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            As primeiras videoaulas estão sendo gravadas. Elas aparecem aqui assim que forem
            publicadas.
          </p>
        </div>
      </section>
    );
  }

  const completed = lessons.filter((lesson) => lesson.completedAt).length;
  const percent = Math.round((completed / lessons.length) * 100);
  const resume = lessons
    .filter((lesson) => lesson.lastOpenedAt && !lesson.completedAt)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))
    .slice(0, 3);
  const recent = [...lessons]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 3);

  // `matches` keeps the API order (track, module, lesson), so grouping is a single pass.
  const tracks: {
    id: number;
    title: string;
    description: string;
    modules: { id: number; title: string; lessons: LessonSummary[] }[];
  }[] = [];
  for (const lesson of matches) {
    let track = tracks.find((item) => item.id === lesson.trackId);
    if (!track) {
      track = {
        id: lesson.trackId,
        title: lesson.trackTitle,
        description: lesson.trackDescription,
        modules: [],
      };
      tracks.push(track);
    }
    let mod = track.modules.find((item) => item.id === lesson.moduleId);
    if (!mod) {
      mod = { id: lesson.moduleId, title: lesson.moduleTitle, lessons: [] };
      track.modules.push(mod);
    }
    mod.lessons.push(lesson);
  }

  return (
    <div className="space-y-10">
      <section
        aria-label="Seu progresso"
        className="rounded-2xl border border-line bg-surface/60 p-5"
      >
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-text">
            {completed} de {lessons.length}{" "}
            {lessons.length === 1 ? "aula concluída" : "aulas concluídas"}
          </span>
          <span className="text-muted">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Aulas concluídas"
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
      >
        <label className="relative block">
          <span className="sr-only">Buscar por título ou descrição</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            className="field-input !pl-10"
            placeholder="Buscar por título ou descrição"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="sr-only">Categoria</span>
          <select
            className="field-input !pl-4"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Nível</span>
          <select
            className="field-input !pl-4"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Todos os níveis</option>
            {Object.entries(LEVEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {!filtering && resume.length > 0 && (
        <section aria-labelledby="lessons-resume">
          <h2 id="lessons-resume" className="text-xs uppercase tracking-[0.14em] text-gold">
            Continue assistindo
          </h2>
          <Grid lessons={resume} />
        </section>
      )}

      {!filtering && (
        <section aria-labelledby="lessons-recent">
          <h2 id="lessons-recent" className="text-xs uppercase tracking-[0.14em] text-gold">
            Aulas recentes
          </h2>
          <Grid lessons={recent} />
        </section>
      )}

      <p aria-live="polite" className="text-sm text-muted">
        {filtering
          ? `${matches.length} ${matches.length === 1 ? "aula encontrada" : "aulas encontradas"}`
          : null}
      </p>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
          Nenhuma aula bate com essa busca.{" "}
          <button
            type="button"
            className="text-gold underline underline-offset-2"
            onClick={() => {
              setQuery("");
              setCategory("");
              setLevel("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        tracks.map((track) => (
          <section key={track.id} aria-labelledby={`track-${track.id}`}>
            <h2
              id={`track-${track.id}`}
              className="font-[family-name:var(--font-display)] text-xl font-semibold text-text"
            >
              {track.title}
            </h2>
            {track.description && <p className="mt-1 text-sm text-muted">{track.description}</p>}
            {track.modules.map((mod) => (
              <div key={mod.id} className="mt-5">
                <h3 className="text-xs uppercase tracking-[0.14em] text-muted">{mod.title}</h3>
                <Grid lessons={mod.lessons} />
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
