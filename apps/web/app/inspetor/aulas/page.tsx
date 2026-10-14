import type { Metadata } from "next";
import { LessonsAdmin } from "@/components/lessons-admin";
import { getAdminLessons } from "@/lib/lessons-db";
import { requireCapability } from "@/lib/server-session";

export const metadata: Metadata = { title: "Videoaulas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  await requireCapability("content.manage");
  return <LessonsAdmin data={await getAdminLessons()} />;
}
