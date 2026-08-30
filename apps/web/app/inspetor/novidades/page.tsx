import type { Metadata } from "next";
import { NewsPanel } from "@/components/news-panel";
import { allNews } from "@/lib/news-db";

export const metadata: Metadata = { title: "Novidades — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const list = await allNews();
  return <NewsPanel initials={list} />;
}
