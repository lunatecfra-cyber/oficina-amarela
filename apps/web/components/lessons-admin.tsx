"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  type AdminLesson,
  type AdminLessons,
  LEVEL_LABEL,
  type LessonLevel,
  type LessonStatus,
} from "@/lib/lessons-db";

const STATUS_LABEL: Record<LessonStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

type Form = {
  moduleId: string;
  title: string;
  description: string;
  category: string;
  level: LessonLevel;
  videoUrl: string;
  durationMinutes: string;
  position: string;
};

const EMPTY: Form = {
  moduleId: "",
  title: "",
  description: "",
  category: "",
  level: "beginner",
  videoUrl: "",
  durationMinutes: "",
  position: "0",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function LessonsAdmin({ data }: { data: AdminLessons }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [moduleTrackId, setModuleTrackId] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState("");

  const moduleLabel = new Map(
    data.modules.map((mod) => [
      mod.id,
      `${data.tracks.find((track) => track.id === mod.trackId)?.title ?? "?"} › ${mod.title}`,
    ]),
  );
  const categories = [...new Set(data.lessons.map((lesson) => lesson.category).filter(Boolean))];

  async function send(method: string, path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setWarning("");
    const resp = await fetch(`/api/admin/lessons${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!resp?.ok) {
      const detail = await resp?.json().catch(() => null);
      setWarning(detail?.error ?? "Não deu pra concluir.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addTrack() {
    if (await send("POST", "/tracks", { title: trackTitle })) setTrackTitle("");
  }

  async function addModule() {
    if (await send("POST", "/modules", { trackId: Number(moduleTrackId), title: moduleTitle }))
      setModuleTitle("");
  }

  async function saveLesson(status: "draft" | "published") {
    const payload = {
      moduleId: Number(form.moduleId),
      title: form.title,
      description: form.description,
      category: form.category,
      level: form.level,
      videoUrl: form.videoUrl,
      durationMinutes: form.durationMinutes === "" ? "" : Number(form.durationMinutes),
      position: Number(form.position || 0),
    };
    // Editing keeps the current status unless the button asks for a publication.
    const saved =
      editingId === null
        ? await send("POST", "", { ...payload, status })
        : await send(
            "PATCH",
            `/${editingId}`,
            status === "published" ? { ...payload, status } : payload,
          );
    if (!saved) return;
    setForm(EMPTY);
    setEditingId(null);
  }

  function edit(lesson: AdminLesson) {
    setEditingId(lesson.id);
    setForm({
      moduleId: String(lesson.moduleId),
      title: lesson.title,
      description: lesson.description,
      category: lesson.category,
      level: lesson.level,
      videoUrl: lesson.videoUrl,
      durationMinutes: lesson.durationMinutes === null ? "" : String(lesson.durationMinutes),
      position: String(lesson.position),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const set = (key: keyof Form) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setWarning("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Videoaulas
      </h1>
      <p className="mt-1 text-sm text-muted">
        Cadastre as aulas e escolha quando elas aparecem para os editores.
      </p>

      <details
        className="mt-8 rounded-2xl border border-line bg-surface/60 p-5"
        open={data.modules.length === 0}
      >
        <summary className="cursor-pointer font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Trilhas e módulos ({data.tracks.length} / {data.modules.length})
        </summary>
        <p className="mt-2 text-sm text-muted">
          Uma trilha é um tema (ex.: Fundamentos). Um módulo é um bloco dentro dela (ex.: Corte e
          ritmo). Toda aula fica dentro de um módulo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Nova trilha">
            <input
              className="field-input !pl-4"
              value={trackTitle}
              onChange={(event) => setTrackTitle(event.target.value)}
              maxLength={120}
              placeholder="ex.: Fundamentos"
            />
          </Field>
          <button
            type="button"
            className="btn-ghost self-end"
            disabled={busy || !trackTitle.trim()}
            onClick={addTrack}
          >
            Criar trilha
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Trilha do módulo">
            <select
              className="field-input !pl-4"
              value={moduleTrackId}
              onChange={(event) => setModuleTrackId(event.target.value)}
            >
              <option value="">Escolha…</option>
              {data.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Novo módulo">
            <input
              className="field-input !pl-4"
              value={moduleTitle}
              onChange={(event) => setModuleTitle(event.target.value)}
              maxLength={120}
              placeholder="ex.: Corte e ritmo"
            />
          </Field>
          <button
            type="button"
            className="btn-ghost self-end"
            disabled={busy || !moduleTrackId || !moduleTitle.trim()}
            onClick={addModule}
          >
            Criar módulo
          </button>
        </div>
      </details>

      <section className="mt-6 rounded-2xl border border-gold-lo/40 bg-gradient-to-b from-gold/[0.05] to-transparent p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          {editingId === null ? "Nova aula" : "Editando aula"}
        </h2>

        {data.modules.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Crie uma trilha e um módulo para começar.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Módulo">
                <select
                  className="field-input !pl-4"
                  value={form.moduleId}
                  onChange={set("moduleId")}
                >
                  <option value="">Escolha…</option>
                  {data.modules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {moduleLabel.get(mod.id)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Título">
                <input
                  className="field-input !pl-4"
                  value={form.title}
                  onChange={set("title")}
                  maxLength={120}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Link do vídeo (YouTube ou Google Drive)">
                <input
                  className="field-input !pl-4"
                  value={form.videoUrl}
                  onChange={set("videoUrl")}
                  placeholder="https://youtu.be/…"
                  inputMode="url"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <textarea
                  className="field-input !pl-4 min-h-24 resize-y py-3"
                  value={form.description}
                  onChange={set("description")}
                  maxLength={2000}
                />
              </Field>
            </div>
            <Field label="Categoria">
              <input
                className="field-input !pl-4"
                list="lesson-categories"
                value={form.category}
                onChange={set("category")}
                maxLength={60}
                placeholder="ex.: Edição"
              />
              <datalist id="lesson-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <Field label="Nível">
              <select className="field-input !pl-4" value={form.level} onChange={set("level")}>
                {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duração (minutos)">
              <input
                className="field-input !pl-4"
                type="number"
                min={1}
                max={600}
                value={form.durationMinutes}
                onChange={set("durationMinutes")}
              />
            </Field>
            <Field label="Ordem no módulo">
              <input
                className="field-input !pl-4"
                type="number"
                min={0}
                max={9999}
                value={form.position}
                onChange={set("position")}
              />
            </Field>
          </div>
        )}

        {warning && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {warning}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-gold sm:w-52"
            disabled={busy || data.modules.length === 0}
            onClick={() => saveLesson("published")}
          >
            {busy ? "Salvando…" : "Publicar"}
          </button>
          <button
            type="button"
            className="btn-ghost sm:w-52"
            disabled={busy || data.modules.length === 0}
            onClick={() => saveLesson("draft")}
          >
            {editingId === null ? "Salvar rascunho" : "Salvar alterações"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              className="btn-ghost sm:w-40"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
                setWarning("");
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.14em] text-gold">
          Aulas ({data.lessons.length})
        </h2>
        {data.lessons.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-line-soft bg-surface/40 p-6 text-center text-sm text-muted">
            Nenhuma aula cadastrada ainda.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.lessons.map((lesson) => (
              <li key={lesson.id} className="rounded-2xl border border-line bg-surface/60 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
                  <span
                    className={
                      lesson.status === "published"
                        ? "text-ok"
                        : lesson.status === "draft"
                          ? "text-gold"
                          : "text-muted"
                    }
                  >
                    {STATUS_LABEL[lesson.status]}
                  </span>
                  <span className="text-muted">{moduleLabel.get(lesson.moduleId)}</span>
                </div>
                <p className="mt-1 font-medium text-text">{lesson.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => edit(lesson)}
                  >
                    Editar
                  </button>
                  {lesson.status !== "published" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => send("PATCH", `/${lesson.id}`, { status: "published" })}
                    >
                      Publicar
                    </button>
                  )}
                  {lesson.status === "published" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => send("PATCH", `/${lesson.id}`, { status: "draft" })}
                    >
                      Voltar a rascunho
                    </button>
                  )}
                  {lesson.status !== "archived" ? (
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busy}
                      onClick={() => send("PATCH", `/${lesson.id}`, { status: "archived" })}
                    >
                      Arquivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => send("PATCH", `/${lesson.id}`, { status: "draft" })}
                    >
                      Restaurar como rascunho
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
