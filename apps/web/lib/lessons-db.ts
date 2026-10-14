import { fetchApiJson } from "@/lib/internal-api";

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

export async function getLessons(): Promise<LessonSummary[]> {
  const body = await fetchApiJson<{ lessons: LessonSummary[] }>("/lessons");
  return body?.lessons ?? [];
}

export function getLesson(id: number): Promise<LessonDetail | null> {
  return fetchApiJson<LessonDetail>(`/lessons/${id}`);
}

export async function getAdminLessons(): Promise<AdminLessons> {
  return (
    (await fetchApiJson<AdminLessons>("/admin/lessons")) ?? { tracks: [], modules: [], lessons: [] }
  );
}
