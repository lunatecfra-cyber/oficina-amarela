import type { Metadata } from "next";
import { NewsPanel } from "@/components/news-panel";
import { getAllNews } from "@/lib/news-db";
import { requireCapability } from "@/lib/server-session";

export const metadata: Metadata = { title: "Novidades — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  await requireCapability("content.manage");
  const list = await getAllNews();
  return <NewsPanel initials={list} />;
}
