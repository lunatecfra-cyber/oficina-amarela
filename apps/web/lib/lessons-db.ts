import { fetchApi } from "@/lib/internal-api";

export type LessonLevel = "beginner" | "intermediate" | "advanced";
export type LessonStatus = "draft" | "published" | "archived";

export const LEVEL_LABEL: Record<LessonLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export type LessonSummary = {
  id: number;
  title: string;
  description: string;
  category: string;
  level: LessonLevel;
  durationMinutes: number | null;
  publishedAt: string | null;
  moduleId: number;
  moduleTitle: string;
  trackId: number;
  trackTitle: string;
  trackDescription: string;
  completedAt: string | null;
  lastOpenedAt: string | null;
};

export type LessonDetail = LessonSummary & { videoUrl: string };

export type AdminTrack = { id: number; title: string; description: string; position: number };
export type AdminModule = { id: number; trackId: number; title: string; position: number };
export type AdminLesson = {
  id: number;
  moduleId: number;
  title: string;
  description: string;
  category: string;
  level: LessonLevel;
  videoUrl: string;
  durationMinutes: number | null;
  position: number;
  status: LessonStatus;
  publishedAt: string | null;
  updatedAt: string;
  author: string | null;
};
export type AdminLessons = {
  tracks: AdminTrack[];
  modules: AdminModule[];
  lessons: AdminLesson[];
};

// A failed read must not look like an empty catalog ("Em breve") or an empty admin
// panel, where Vitor would re-create what he thinks is missing. Throwing hands it to
// app/error.tsx, which already offers a retry and reports to Sentry.
async function failIfNotOk(response: Response, path: string): Promise<Response> {
  if (!response.ok) throw new Error(`Videoaulas: ${path} respondeu ${response.status}`);
  return response;
}

export async function getLessons(): Promise<LessonSummary[]> {
  const response = await failIfNotOk(await fetchApi("/lessons"), "/lessons");
  return ((await response.json()) as { lessons: LessonSummary[] }).lessons;
}

/** `null` only when the lesson does not exist or is not published; any other failure throws. */
export async function getLesson(id: number): Promise<LessonDetail | null> {
  const response = await fetchApi(`/lessons/${id}`);
  if (response.status === 404) return null;
  await failIfNotOk(response, `/lessons/${id}`);
  return (await response.json()) as LessonDetail;
}

export async function getAdminLessons(): Promise<AdminLessons> {
  const response = await failIfNotOk(await fetchApi("/admin/lessons"), "/admin/lessons");
  return (await response.json()) as AdminLessons;
}
